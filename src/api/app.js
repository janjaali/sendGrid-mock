const log4js = require('log4js');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');

let logger = log4js.getLogger('sendgrid-mock');
logger.level = 'debug';

const app = express();
app.use(bodyParser.json({limit: '5mb'}));

let mails = [];

app.post('/v3/mail/send', (req, res) => {
    const reqApiKey = req.headers.authorization;
    if (reqApiKey === `Bearer ${process.env.API_KEY}`) {
        deleteOldMails();

        const mailWithTimestamp = { ...req.body, datetime: new Date() };
        mails = [...mails, mailWithTimestamp];
        res.sendStatus(202);
        
        const memoryUsage = process.memoryUsage();
        console.info(`SendGrid Mock has ${mails.length} mails. (Memory: ${formatBytes(memoryUsage.heapUsed)} used of ${formatBytes(memoryUsage.heapTotal)})`);
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

app.get('/api/mails', (req, res) => {
    let results = mails;
    if(req.query.to) {
        results = results.filter(email => emailWasSentTo(email, req.query.to))
    }
    if(req.query.subject) {
        results = results.filter(email => emailContainsSubject(email, req.query.subject))
    }
    if(req.query.dateTimeSince) {
        results = results.filter(email => emailWasSentAfter(email, req.query.dateTimeSince))
    }
    res.send(results);
});

app.delete('/api/mails', (req, res) => {
    if(req.query.to) {
        mails = mails.filter(email => !emailWasSentTo(email, req.query.to));
    } else {
        mails = [];
    }
    res.send(200);
});

if(process.env.AUTHENTICATION) {
    const basicAuth = require('express-basic-auth')
    const authenticationParams = process.env.AUTHENTICATION.split(";");
    const users = {};
    for (const auth of authenticationParams) {
        const userPasswordCombo = auth.split(":");
        users[userPasswordCombo[0]] = userPasswordCombo[1];
    }
    app.use(basicAuth({challenge: true, users}));
}
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
    mails = mails.filter(email => email["datetime"] > dateTimeBoundary);
}

function emailWasSentTo(email, to) {
    const personalizations = email["personalizations"];
    for(personalization of personalizations) {
        for(receiver of personalization["to"]) {
            if(to.startsWith('%') && to.endsWith('%')) {
                searchTo = to.substring(1, to.length - 1);
                if(receiver["email"].includes(searchTo)) {
                    return true;
                }
            } else {
                if(receiver["email"] == to) {
                    return true;
                }
            }
        }
    }
    return false;
}

function emailContainsSubject(email, subject) {
    let actualSubject = email["subject"];
    if(subject.startsWith('%') && subject.endsWith('%')) {
        searchSubject = subject.substring(1, subject.length - 1);
        return actualSubject.includes(searchSubject);
    }
    return actualSubject === subject;
}

function emailWasSentAfter(email, dateTimeSinceAsString) {
    let dateTimeSince = Date.parse(dateTimeSinceAsString);
    if(isNaN(dateTimeSince)) {
        throw "The provided date cannot be parsed";
    }
    return email["datetime"] > dateTimeSince;
}

function parseDurationString(durationString){
    var stringPattern = /^PT(?:(\d+)D)?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d{1,3})?)S)?$/;
    var stringParts = stringPattern.exec(durationString.trim());
    return (
             (
               (
                 ( stringParts[1] === undefined ? 0 : stringParts[1]*1 )  /* Days */
                 * 24 + ( stringParts[2] === undefined ? 0 : stringParts[2]*1 ) /* Hours */
               )
               * 60 + ( stringParts[3] === undefined ? 0 : stringParts[3]*1 ) /* Minutes */
             )
             * 60 + ( stringParts[4] === undefined ? 0 : stringParts[4]*1 ) /* Seconds */
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