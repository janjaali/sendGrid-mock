const log4js = require('log4js');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');

let logger = log4js.getLogger('sendgrid-mock');
logger.level = 'debug';

const app = express();
app.use(bodyParser.json());

let mails = [];

app.post('/v3/mail/send', (req, res) => {
    const reqApiKey = req.headers.authorization;
    if (reqApiKey === `Bearer ${process.env.API_KEY || '90c3a3ae-163c-4d79-9988-a8893f1e6546'}`) {
        const mailWithTimestamp = { ...req.body, datetime: new Date() };
        mails = [...mails, mailWithTimestamp];
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

app.get('/api/mails', (req, res) => {
    let results = mails;
    if(req.query.to) {
        results = results.filter(email => filterByEmail(email, req.query.to))
    }
    if(req.query.subject) {
        results = results.filter(email => filterBySubject(email, req.query.subject))
    }
    res.send(results);
});

app.delete('/api/mails', (req, res) => {
    if(req.query.to) {
        mails = mails.filter(email => !filterByEmail(email, req.query.to))
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

function filterByEmail(email, to) {
    let actualToEmail = email["personalizations"][0]["to"][0]["email"];
    return actualToEmail === to;
}

function filterBySubject(email, subject) {
    let actualSubject = email["subject"];
    if(subject.startsWith('%') && subject.endsWith('%')) {
        searchSubject = subject.substring(1, subject.length - 1);
        console.log('Searching for emails with subject containing', searchSubject);
        return actualSubject.includes(searchSubject);
    }
    return actualSubject === subject;
}