const express = require('express');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { loggerFactory } = require('../logger/log4js');
const path = require('path');
const { spawn } = require('child_process');
const sanitize = require('sanitize-filename');
const { rateLimit } = require('express-rate-limit');

/** Binds an existing Express server application with SSL certificate to 
 * provide it via HTTPS using Certbot and Let's Encrypt. This implementation is 
 * heavenly inspired by the excellent work of https://github.com/AppSaloon/auto-ssl. */

const logger = loggerFactory('SSL');

const domain = process.env.CERT_DOMAINNAMES && process.env.CERT_DOMAINNAMES.split(',')[0];
const certificationPath = `/etc/letsencrypt/live/${domain}`;
const archivePath = `/etc/letsencrypt/archive/${domain}`;

const privateKeyPath = `${certificationPath}/privkey.pem`;
const pemFilePath = `${certificationPath}/fullchain.pem`;

const readCertificate = () => {

  try {
    return {
      key: fs.readFileSync(privateKeyPath, 'utf8'),
      cert: fs.readFileSync(pemFilePath, 'utf8')
    };
  } catch (e) {
    return undefined;
  }
};

const watchCertificateFiles = (httpsServer) => {

  try {
    fs.watch(archivePath, () => {
      const newPrivateKey = fs.readFileSync(privateKeyPath, 'utf8');
      const newPem = fs.readFileSync(pemFilePath, 'utf8');

      httpsServer._sharedCreds.context.setCert(newPem);
      httpsServer._sharedCreds.context.setKey(newPrivateKey);
    });
  } catch (e) {
    logger.error(e);
  }
};

const createAndStartHttpsServer = (expressApp, certificate) => {

  const httpsPort = 443;
  const httpsServer = https.createServer(certificate, expressApp);
  httpsServer.listen(httpsPort, () => {
    logger.info(`HTTPS server listens on port ${httpsPort}.`);
  });

  return httpsServer;
};

const asHttpsServer = (expressApp, rateLimitConfiguration) => {

  const httpToHttpsForwardingExpressApp = express();

  if (rateLimitConfiguration.enabled) {
  
    const rateLimitWindowInMs = rateLimitConfiguration.windowInMs;
    const rateLimitMaxRequests = rateLimitConfiguration.maxRequests;
  
    logger.info(`Rate limit enabled with ${rateLimitMaxRequests} requests per ${rateLimitWindowInMs} ms.`);
  
    const definedRateLimit = rateLimit({
      windowMs: rateLimitWindowInMs,
      max: rateLimitMaxRequests,
      standardHeaders: true,
    });
  
    httpToHttpsForwardingExpressApp.use(definedRateLimit);  
  
  } else {
    logger.warn('Rate limit is disabled!');
  }

  httpToHttpsForwardingExpressApp.get('*', (req, res) => {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  });

  // see https://eff-certbot.readthedocs.io/en/stable/using.html?highlight=well-known#webroot
  const webrootExpressApp = express();
  webrootExpressApp.get('/.well-known/acme-challenge/:fileName', (req, res) => {

    const sanitizedFileName = sanitize(req.params.fileName);

    const filePath = path.join(
      '/usr/src/server',
      '.well-known/acme-challenge/',
      sanitizedFileName
    );

    if (fs.existsSync(filePath)) {
      logger.info(`Return existing file ${filePath}.`);
      res.sendFile(filePath);
    } else {
      logger.warn(`Return 404 Not Found for non-existing file ${filePath}.`);
      res.send(404);
    }
  });
  webrootExpressApp.use(httpToHttpsForwardingExpressApp);

  const webrootServer = http.createServer(webrootExpressApp);
  webrootServer.listen(80, () => {
    logger.info('HTTP server serving as webroot server listens on port 80.');
  });

  const certificate = readCertificate();
  if (certificate) {

    logger.info('Certificate exists, starting to create HTTPS server.');
    const httpsServer = createAndStartHttpsServer(expressApp, certificate);

    logger.info('Starting to watch certificate files.');
    watchCertificateFiles(httpsServer);
  } else {

    logger.info('Certificate does not exist, creating one.');

    const initServer = spawn('.', ['/letsencrypt_webroot.sh'], { cwd: '/', shell: true });

    initServer.stdout.on('data', data => {
      logger.info(data.toString());
    });

    initServer.stderr.on('data', data => {
      logger.info(data.toString());
    });

    initServer.on('close', code => {

      if (code === 0) {
        logger.info('Certificate created, starting to create HTTPS server.');	

        const certificate = readCertificate();
        const httpsServer = createAndStartHttpsServer(expressApp, certificate);
  
        logger.info('Starting to watch certificate files.');
        watchCertificateFiles(httpsServer);
      } else {
        logger.error(`letsencrypt_webroot.sh exited with code ${code}, not starting HTTPS server.`);
      }
    });
  }

  return webrootServer;
};

module.exports = asHttpsServer;
