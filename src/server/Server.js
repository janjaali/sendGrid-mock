const autoSsl = require('@appsaloon/auto-ssl')
const {loggerFactory} = require('./logger/log4js');
const {setupExpressApp} = require('./ExpressApp');
const MailHandler = require('./handler/MailHandler');

const logger = loggerFactory('Server');

const authenticationUsers = (usersString) => {

  const authenticationParams = usersString.split(';');
  
  const users = authenticationParams.flatMap( auth => {
    const userPasswordPair = auth.split(':');
    return {
      [userPasswordPair[0]]: userPasswordPair[1]
    };
  });

  return Object.assign(...users);
};

const mailHandler = new MailHandler(process.env.MAIL_HISTORY_DURATION);

const apiAuthentication = process.env.AUTHENTICATION
  ? {enabled: true, users: authenticationUsers(process.env.AUTHENTICATION) }
  : {enabled: false};



const enableSsl = process.env.CERT_DOMAINNAMES ? true : false;

const app = setupExpressApp(mailHandler, apiAuthentication, process.env.API_KEY);

if(enableSsl) {
  autoSsl(app);
} else {
  const serverPort = 3000;
  app.listen(serverPort, () => logger.info(`Started service on port ${serverPort}!`));
}

