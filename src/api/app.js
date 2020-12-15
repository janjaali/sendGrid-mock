const log4js = require('log4js');
const path = require('path');
const express = require('express');
const basicAuth = require('express-basic-auth');
const bodyParser = require('body-parser');

const logger = log4js.getLogger('sendgrid-mock');
logger.level = 'debug';

const app = express();
app.use(bodyParser.json({ limit: '5mb' }));

let mails = [];

app.post('/v3/mail/send', (req, res) => {
  const reqApiKey = req.headers.authorization;
  if (reqApiKey === `Bearer ${process.env.API_KEY}`) {
    deleteOldMails();

    const mailWithTimestamp = { ...req.body, datetime: new Date() };
    mails = [mailWithTimestamp, ...mails];
    res.sendStatus(202);

    const memoryUsage = process.memoryUsage();
    logger.info(`SendGrid Mock has ${mails.length} mails. (Memory: ${formatBytes(memoryUsage.heapUsed)} used of ${formatBytes(memoryUsage.heapTotal)})`);
  } else {
    res.status(403).send({
      errors: [{
        message: 'Failed authentication',
        field: 'authorization',
        help: 'check used api-key for authentication',
      }],
      id: 'forbidden',
    });
  }
});

if (process.env.AUTHENTICATION) {
  const authenticationParams = process.env.AUTHENTICATION.split(';');

  const users = authenticationParams.flatMap( auth => {
    const userPasswordPair = auth.split(':');
    return {
      [userPasswordPair[0]]: userPasswordPair[1]
    };
  });
 
  app.use(basicAuth({ challenge: true, users: Object.assign(...users) }));
}

app.get('/api/mails', (req, res) => {
  let results = mails;
  if (req.query.to) {
    results = results.filter(email => emailWasSentTo(email, req.query.to));
  }
  if (req.query.subject) {
    results = results.filter(email => emailContainsSubject(email, req.query.subject));
  }
  if (req.query.dateTimeSince) {
    results = results.filter(email => emailWasSentAfter(email, req.query.dateTimeSince));
  }

  if (req.query.page && req.query.pageSize) {
    const start = parseInt(req.query.page) * parseInt(req.query.pageSize);
    const end = start + parseInt(req.query.pageSize);
    results = results.slice(start, end);
  } else {
    results = results.slice(0, 20);
  }
  res.send(results);
});

app.delete('/api/mails', (req, res) => {
  if (req.query.to) {
    mails = mails.filter(email => !emailWasSentTo(email, req.query.to));
  } else {
    mails = [];
  }
  res.send(200);
});

app.use(express.static(path.join(__dirname, '../../dist')));
app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, '../../dist', 'index.html'));
});

const port = 3000;
app.listen(port, () => logger.info(`Start service on port ${port}!`));

function deleteOldMails() {
  const cleanUpAfter = process.env.MAIL_HISTORY_DURATION || 'PT24H';
  const durationAsSeconds = parseDurationString(cleanUpAfter);
  const dateTimeBoundary = new Date(Date.now() - (durationAsSeconds * 1000));
  mails = mails.filter(email => email['datetime'] > dateTimeBoundary);
}

/**
 * Checks whether email.personalizations contains queryTo string.
 * 
 * Checks if the string is partially contained if queryTo starts and ends with 
 * the % character such as '%foo%'. Otherwise checks for exact match. 
 * 
 * @param {personalizations} email 
 * @param string queryTo 
 */
function emailWasSentTo(email, queryTo) {

  if (Array.isArray(email.personalizations)) {
    
    const matcherFn = queryTo.startsWith('%') && queryTo.endsWith('%')
      ? string => string.toLowerCase().includes(queryTo.substring(1, queryTo.length -1).toLowerCase())
      : string => string.toLowerCase() == queryTo.toLowerCase();

    return email
      .personalizations
      .flatMap(personalization => personalization.to)
      .some(to => matcherFn(to.email));
  } else {
    return false;
  }
}

/**
 * Checks whether email.subject contains querySubject string.
 * 
 * Checks if the string is partially contained if querySubject starts and ends 
 * with the % character such as '%foo%'. Otherwise checks for exact match. 
 * 
 * @param {subject} email 
 * @param string querySubject 
 */
function emailContainsSubject(email, querySubject) {
  const actualSubject = email.subject;
  
  if (querySubject.startsWith('%') && querySubject.endsWith('%')) {
    const searchSubject = querySubject.substring(1, querySubject.length - 1);
    return actualSubject.toLowerCase().includes(searchSubject.toLowerCase());
  } else {
    return actualSubject.toLowerCase() === querySubject.toLowerCase();
  }  
}

function emailWasSentAfter(email, dateTimeSinceAsString) {
  const dateTimeSince = Date.parse(dateTimeSinceAsString);
  if (isNaN(dateTimeSince)) {
    throw 'The provided date cannot be parsed';
  }
  return email['datetime'] > dateTimeSince;
}

function parseDurationString(durationString) {
  var stringPattern = /^PT(?:(\d+)D)?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d{1,3})?)S)?$/;
  var stringParts = stringPattern.exec(durationString.trim());
  return (
    (
      (
        (stringParts[1] === undefined ? 0 : stringParts[1] * 1)  /* Days */
                * 24 + (stringParts[2] === undefined ? 0 : stringParts[2] * 1) /* Hours */
      )
            * 60 + (stringParts[3] === undefined ? 0 : stringParts[3] * 1) /* Minutes */
    )
        * 60 + (stringParts[4] === undefined ? 0 : stringParts[4] * 1) /* Seconds */
  );
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}