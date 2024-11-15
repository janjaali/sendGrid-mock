import axios from 'axios';
import crypto from 'crypto';
import { loggerFactory } from '../logger/log4js.ts';
import { Mail, MailPersonalization } from '@/types/Mail.ts';

const logger = loggerFactory('MailHandler');

const mailWithTimestamp = (mail: Mail) => {
  const now = new Date();
  return { datetime: now, ...mail };
};

const formatBytes = (bytes: number, decimals = 2) => {

  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const logMemoryUsage = (mails: Mail[]) => {

  const memoryUsage = process.memoryUsage();

  logger.info(
    `SendGrid Mock has ${mails.length} mails. (Memory: ${formatBytes(memoryUsage.heapUsed)} used of ${formatBytes(memoryUsage.heapTotal)})`
  );
};

const RESERVED_KEYS = ['email', 'timestamp', 'event', 'sg_event_id', 'sg_message_id', 'category', 'smtp-id'];

const parseDurationStringAsSeconds = (durationString: string) => {
  const stringPattern = /^PT(?:(\d+)D)?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d{1,3})?)S)?$/;
  const stringParts = stringPattern.exec(durationString.trim());
  if (stringParts === null || stringParts === undefined) {
    return 0;
  }
  return (
    (
      (
        (stringParts[1] === undefined ? 0 : Number(stringParts[1]) * 1)  /* Days */
                * 24 + (stringParts[2] === undefined ? 0 : Number(stringParts[2]) * 1) /* Hours */
      )
            * 60 + (stringParts[3] === undefined ? 0 : Number(stringParts[3]) * 1) /* Minutes */
    )
        * 60 + (stringParts[4] === undefined ? 0 : Number(stringParts[4]) * 1) /* Seconds */
  );
};

const mailSentTo = (mail: Mail, to?: string) => {

  if (Array.isArray(mail.personalizations)) {

    const matcherFn = to &&to.startsWith('%') && to.endsWith('%')
      ? (string: string) => string.toLowerCase().includes(to.substring(1, to.length -1).toLowerCase())
      : (string: string) => string.toLowerCase() == to?.toLowerCase();

    return mail
      .personalizations
      .flatMap(personalization => personalization.to)
      .some(to => matcherFn(to?.email ?? ''));
  } else {
    return false;
  }
};

const mailContainSubject = (mail: Mail, subject?: string) => {

  const actualSubject = mail.subject;

  if (subject && subject.startsWith('%') && subject.endsWith('%')) {
    const searchSubject = subject.substring(1, subject.length - 1);
    return actualSubject.toLowerCase().includes(searchSubject.toLowerCase());
  } else {
    return actualSubject.toLowerCase() === subject?.toLowerCase();
  }
};

const mailSentAfter = (mail: Mail, dateTime?: string) => {
  if (!dateTime) {
    return true;
  }
  const dateTimeSince = Date.parse(dateTime);

  const dateTimeMail = mail.datetime?.valueOf() ?? 0;

  if (isNaN(dateTimeSince)) {
    throw 'The provided date cannot be parsed';
  }

  return dateTimeMail > dateTimeSince;
};

class MailHandler {

  #mails: Array<Mail> = [];

  #mailRetentionDurationInSeconds = 86400; // one day

  constructor(mailRetentionDuration?: string | undefined) {

    if (mailRetentionDuration) {
      this.#mailRetentionDurationInSeconds = parseDurationStringAsSeconds(
        mailRetentionDuration
      );
    }
  }

  getMails(filterCriteria?: { to?: string; subject?: string; dateTimeSince?: string; }, paginationCriteria?: { pageSize?: number; page?: number; }) {

    const filters = [
      filterCriteria?.to ?
        (mail: Mail) => mailSentTo(mail, filterCriteria.to)
        : () => true,
      filterCriteria?.subject ?
        (mail: Mail) => mailContainSubject(mail, filterCriteria.subject)
        : () => true,
      filterCriteria?.dateTimeSince ?
        (mail: Mail) => mailSentAfter(mail, filterCriteria.dateTimeSince) :
          () => true,
    ];

    const paginationSize = paginationCriteria?.pageSize || 20;
    const paginationStart = paginationCriteria?.page ?
      (paginationCriteria.page - 1) * paginationSize :
      0 ;

    return this.#mails
      .filter(mail => filters.every(filter => filter(mail)))
      .slice(paginationStart, paginationStart + paginationSize);
  }

  addMail(mail: Mail, messageId = crypto.randomUUID()) {

    this.#mails = [mailWithTimestamp(mail), ...this.#mails];

    const maxRetentionTime = Date.now() - (this.#mailRetentionDurationInSeconds * 1000);
    this.#mails = this.#mails.filter(mail => {
      return Date.parse(mail.datetime?.toString() ?? '').valueOf() >= maxRetentionTime;
    });

    if (process.env.EVENT_DELIVERY_URL) {
      this.sendDeliveryEvents(mail, messageId);
    }

    logMemoryUsage(this.#mails);
  }

  sendDeliveryEvents(mail: Mail, messageId: string) {
    const datetime = new Date();
    const deliveredEvents = mail.personalizations?.flatMap((personalization: MailPersonalization) => {
        return personalization.to?.map(to => {
          const categories = mail.categories ? mail.categories : [];
          let event = {
            email: to.email,
            timestamp: datetime.getTime(),
            event: 'delivered',
            sg_event_id: crypto.randomUUID(),
            sg_message_id: messageId,
            category: categories,
            "smtp-id": crypto.randomUUID(),
          };

          if (mail.custom_args || personalization.custom_args) {
            const mailCustomArgs = mail.custom_args ? mail.custom_args : {};
            const personalizationCustomArgs = personalization.custom_args ? personalization.custom_args : {};
            //Override mail custom args with personalization custom args
            const customArgs = Object.assign(mailCustomArgs, personalizationCustomArgs);
            //Remove reserved keys for both mail and personalization custom args
            RESERVED_KEYS.forEach(key => delete customArgs[key]);

            event = Object.assign(event, customArgs);
          }

          return event;
        });
      });
    if (!process.env.EVENT_DELIVERY_URL) {
      throw new Error('EVENT_DELIVERY_URL is not set');
    }
    axios.post(process.env.EVENT_DELIVERY_URL, deliveredEvents)
      .then(() => logger.debug(`Delivery events sent successfully to ${process.env.EVENT_DELIVERY_URL}`))
      .catch((error) => logger.debug(`Failed to send delivery events to ${process.env.EVENT_DELIVERY_URL}`, error));
  }

  clear(filterCriteria?: { to: string; }) {

    const filters = [
      filterCriteria?.to ?
            (mail: Mail) => mailSentTo(mail, filterCriteria.to)
        : () => true,
    ];

    this.#mails = this.#mails.filter(mail => !filters.some(filter => filter(mail)));
  }
}

export default MailHandler;
