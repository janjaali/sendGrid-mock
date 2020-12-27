const {loggerFactory} = require('../logger/log4js');

const logger = loggerFactory('MailHandler');

const mailWithTimestamp = (mail) => {
  const now = new Date();
  return { datetime: now, ...mail };
};

const formatBytes = (bytes, decimals = 2) => {

  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const logMemoryUsage = (mails) => {

  const memoryUsage = process.memoryUsage();

  logger.info(
    `SendGrid Mock has ${mails.length} mails. (Memory: ${formatBytes(memoryUsage.heapUsed)} used of ${formatBytes(memoryUsage.heapTotal)})`
  );  
};

const parseDurationStringAsSeconds = (durationString) => {
  var stringPattern = /^PT(?:(\d+)D)?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d{1,3})?)S)?$/;
  var stringParts = stringPattern.exec(durationString.trim());
  return (
    (
      (
        (stringParts[1] === undefined ? 0 : stringParts[1] * 1)  /* Days */
                * 24 + (stringParts[2] === undefined ? 0 : stringParts[2] * 1) /* Hours */
      )
            * 60 + (stringParts[3] === undefined ? 0 : stringParts[3] * 1) /* Minutes */
    )
        * 60 + (stringParts[4] === undefined ? 0 : stringParts[4] * 1) /* Seconds */
  );
};

const mailSentTo = (mail, to) => {
  
  if (Array.isArray(mail.personalizations)) {
    
    const matcherFn = to.startsWith('%') && to.endsWith('%')
      ? string => string.toLowerCase().includes(to.substring(1, to.length -1).toLowerCase())
      : string => string.toLowerCase() == to.toLowerCase();

    return mail
      .personalizations
      .flatMap(personalization => personalization.to)
      .some(to => matcherFn(to.email));
  } else {
    return false;
  }
};

const mailContainSubject = (mail, subject) => {
  
  const actualSubject = mail.subject;
  
  if (subject.startsWith('%') && subject.endsWith('%')) {
    const searchSubject = subject.substring(1, subject.length - 1);
    return actualSubject.toLowerCase().includes(searchSubject.toLowerCase());
  } else {
    return actualSubject.toLowerCase() === subject.toLowerCase();
  }  
};

const mailSentAfter = (mail, dateTime) => {
  
  const dateTimeSince = Date.parse(dateTime);
  
  if (isNaN(dateTimeSince)) {
    throw 'The provided date cannot be parsed';
  }

  return mail.datetime > dateTimeSince;
};

class MailHandler {
    
  #mails = [];

  #mailRetentionDurationInSeconds = 86400; // one day

  constructor(mailRetentionDuration) {

    if (mailRetentionDuration) {
      this.#mailRetentionDurationInSeconds = parseDurationStringAsSeconds(
        mailRetentionDuration
      ); 
    }
  }

  getMails(filterCriteria, paginationCriteria) {
  
    const filters = [
      filterCriteria?.to ? 
        mail => mailSentTo(mail, filterCriteria.to) 
        : _ => true,
      filterCriteria?.subject ? 
        mail => mailContainSubject(mail, filterCriteria.subject) 
        : _ => true,
      filterCriteria?.dateTimeSince ?
        mail => mailSentAfter(mail, filterCriteria.dateTimeSince) :
        _ => true,
    ];

    const paginationSize = paginationCriteria?.pageSize || 20;
    const paginationStart = paginationCriteria?.page ? 
      (paginationCriteria.page - 1) * paginationSize :
      0 ;

    return this.#mails
      .filter(mail => filters.every(filter => filter(mail)))
      .slice(paginationStart, paginationStart + paginationSize);
  }

  addMail(mail) {

    this.#mails = [mailWithTimestamp(mail), ...this.#mails];

    const maxRetentionTime = Date.now() - (this.#mailRetentionDurationInSeconds * 1000);
    this.#mails = this.#mails.filter(mail => {
      return Date.parse(mail.datetime).valueOf() >= maxRetentionTime;
    });

    logMemoryUsage(this.#mails);
  }

  clear(filterCriteria) {
    
    const filters = [
      filterCriteria?.to ? 
        mail => mailSentTo(mail, filterCriteria.to) 
        : _ => true,
    ];

    this.#mails = this.#mails.filter(mail => !filters.some(filter => filter(mail)));
  }
}

module.exports = MailHandler;
