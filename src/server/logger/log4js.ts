import log4js from 'log4js';

const loggerFactory = (category: string | undefined) => {
  const logger = log4js.getLogger(category);
  logger.level = log4js.levels.INFO;

  return logger;
};

export {
  loggerFactory,
};
