const log4js = require('log4js');

const loggerFactory = (category) => {
  const logger = log4js.getLogger(category);
  logger.level = log4js.levels.INFO;

  return logger;
};

module.exports = {
  loggerFactory,
};
