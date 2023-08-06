const path = require('path');
const express = require('express');
const basicAuth = require('express-basic-auth');
const { rateLimit } = require('express-rate-limit');
const { loggerFactory } = require('./logger/log4js');
const RequestHandler = require('./RequestHandler');

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

  // Request handler for non-static requests.
  RequestHandler(app, mockedApiAuthenticationKey, mailHandler);

  // Static content.
  app.use(express.static(path.join(__dirname, '../../dist')));
  app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, '../../dist', 'index.html'));
  });
  
  return app;
};

module.exports = {
  setupExpressApp,
};
