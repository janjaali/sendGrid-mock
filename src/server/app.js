const log4js = require('log4js');
const path = require('path');
const express = require('express');
const basicAuth = require('express-basic-auth');
const bodyParser = require('body-parser');

const logger = log4js.getLogger('sendgrid-mock');
logger.level = 'debug';

const MailHandler = require('./handler/MailHandler');

const mailHandler = new MailHandler(process.env.MAIL_HISTORY_DURATION);

const app = express();
app.use(bodyParser.json({ limit: '5mb' }));

app.post('/v3/mail/send', (req, res) => {

  const reqApiKey = req.headers.authorization;
  
  if (reqApiKey === `Bearer ${process.env.API_KEY}`) {
    
    mailHandler.addMail(req.body);

    res.sendStatus(202);
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

  const filterCriteria = {
    to: req.query.to,
    subject: req.query.subject,
    dateTimeSince: req.query.dateTimeSince,
  };

  const paginationCriteria = {
    page: req.query.page,
    pageSize: req.query.pageSize,
  };

  const mails = mailHandler.getMails(filterCriteria, paginationCriteria);
  
  res.send(mails);
});

app.delete('/api/mails', (req, res) => {

  const filterCriteria = {
    to: req.query.to,
  };

  mailHandler.clear(filterCriteria);

  res.send(202);
});

app.use(express.static(path.join(__dirname, '../../dist')));
app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, '../../dist', 'index.html'));
});

const port = 3000;
app.listen(port, () => logger.info(`Start service on port ${port}!`));
