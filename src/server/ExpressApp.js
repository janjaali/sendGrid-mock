const path = require('path');
const express = require('express');
const basicAuth = require('express-basic-auth');
const bodyParser = require('body-parser');

const setupExpressApp = (mailHandler, apiAuthentication, mockedApiAuthenticationKey) => {

  const app = express();

  app.use(bodyParser.json({ limit: '5mb' }));

  app.post('/v3/mail/send', (req, res) => {

    const reqApiKey = req.headers.authorization;
    
    if (reqApiKey === `Bearer ${mockedApiAuthenticationKey}`) {
      
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
  
  if (apiAuthentication.enabled) {

    app.use(basicAuth({ challenge: true, users: apiAuthentication.users }));
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
  
    res.sendStatus(202);
  });
  
  app.use(express.static(path.join(__dirname, '../../dist')));
  app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, '../../dist', 'index.html'));
  });
  
  return app;
};

module.exports = {
  setupExpressApp,
};
