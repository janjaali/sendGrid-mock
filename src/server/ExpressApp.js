const crypto = require('crypto');
const path = require('path');
const express = require('express');
const basicAuth = require('express-basic-auth');
const bodyParser = require('body-parser');
const { loggerFactory } = require('./logger/log4js');
const { rateLimit } = require('express-rate-limit');

const logger = loggerFactory('ExpressApp');

const setupExpressApp = (
  mailHandler, 
  apiAuthentication, 
  mockedApiAuthenticationKey, 
  rateLimitConfiguration,
) => {

  const app = express();

  if (apiAuthentication.enabled) {

    app.use(basicAuth({ challenge: true, users: apiAuthentication.users }));
  }

  if (rateLimitConfiguration.enabled) {
  
    const rateLimitWindowInMs = rateLimitConfiguration.windowInMs;
    const rateLimitMaxRequests = rateLimitConfiguration.maxRequests;
  
    logger.info(`Rate limit enabled with ${rateLimitMaxRequests} requests per ${rateLimitWindowInMs} ms.`);
  
    const definedRateLimit = rateLimit({
      windowMs: rateLimitWindowInMs,
      max: rateLimitMaxRequests,
      standardHeaders: true,
    });
  
    app.use(definedRateLimit);  
  
  } else {
    logger.warn('Rate limit is disabled!');
  }

  app.use(bodyParser.json({ limit: '5mb' }));

  app.post('/v3/mail/send', (req, res) => {

    const reqApiKey = req.headers.authorization;
    
    if (reqApiKey === `Bearer ${mockedApiAuthenticationKey}`) {
      
      mailHandler.addMail(req.body);
  
      res.status(202).header({
        'X-Message-ID': crypto.randomUUID(),
      }).send();
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
