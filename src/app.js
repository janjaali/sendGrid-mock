const log4js = require('log4js');
const express = require('express');
const bodyParser = require('body-parser');

let logger = log4js.getLogger('sendgrid-mock');
logger.level = 'debug';

const app = express();
app.use(bodyParser.json());

let mails = [];

app.post('/v3/mail/send', (req, res) => {
    const reqApiKey = req.headers.authorization;
    if (reqApiKey === `Bearer ${process.env.API_KEY}`) {
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

app.get('/mails', (req, res) => {
    res.send(mails);
})

const port = 3000;
app.listen(port, () => logger.info(`Start service on port ${port}!`));
