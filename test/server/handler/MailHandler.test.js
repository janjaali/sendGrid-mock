const {withMockedDate} = require('../../MockDate');

const axios = require('axios');
jest.mock('axios');

const crypto = require('crypto');

const MailHandler = require('../../../src/server/handler/MailHandler');

const testMail = {
  'personalizations': [
    {
      'to': [{
        'email': 'to@example.com'
      }, {
        'email': 'to2@example.com'
      }]
    }
  ],
  'from': {
    'email': 'from@example.com'
  },
  'subject': 'important subject',
  'content': [
    {
      'type': 'text/plain',
      'value': 'important content',
    },
  ],
};

describe('MailHandler', () => {

  describe('add mails', () => {

    test('add mail', () => {

      const sut = new MailHandler();

      const addMailDatetime = new Date('2020-01-01T00:00:00Z');

      withMockedDate(addMailDatetime, () => sut.addMail(testMail));

      const addedMails = sut.getMails();

      expect(addedMails).toStrictEqual([{...testMail, datetime: addMailDatetime}]);
    });

    test('add mails', () => {

      const sut = new MailHandler();

      sut.addMail(testMail);
      sut.addMail(testMail);
      sut.addMail(testMail);

      const addedMails = sut.getMails();

      expect(addedMails.length).toBe(3);
    });

    describe('add mail when EVENT_DELIVERY_URL is set', () => {

      beforeAll(() => {
        process.env.EVENT_DELIVERY_URL = 'http://example.com';
      });

      test('send delivery events', () => {
        const sut = new MailHandler();

        axios.post.mockResolvedValue({data: {message: 'success'}});

        const messageId = crypto.randomUUID();

        sut.addMail(testMail, messageId);

        expect(axios.post.mock.calls[0][0]).toEqual(process.env.EVENT_DELIVERY_URL);
        const eventData = axios.post.mock.calls[0][1];
        expect(eventData.length).toBe(2);
        expect(eventData[0]).toMatchObject({
          email: testMail.personalizations[0].to[0].email,
          event: 'delivered',
          timestamp: expect.any(Number),
          sg_event_id: expect.any(String),
          sg_message_id: messageId,
          'smtp-id': expect.any(String),
        });
      });

      test('send delivery events with defaulted messageId', () => {
        const sut = new MailHandler();

        axios.post.mockResolvedValue({data: {message: 'success'}});

        sut.addMail(testMail);

        expect(axios.post.mock.calls[0][0]).toEqual(process.env.EVENT_DELIVERY_URL);
        const eventData = axios.post.mock.calls[0][1];
        expect(eventData.length).toBe(2);
        expect(eventData[0]).toMatchObject({
          email: testMail.personalizations[0].to[0].email,
          event: 'delivered',
          timestamp: expect.any(Number),
          sg_event_id: expect.any(String),
          sg_message_id: expect.any(String),
          'smtp-id': expect.any(String),
        });
      });
    });

    describe('delete old mails', () => {

      test('if not configured, per default after 24 hours', () => {

        const sut = new MailHandler();

        withMockedDate(new Date('2020-01-01'), () => sut.addMail(testMail));

        const secondMailDatetime = new Date('2020-01-02T00:00:01Z');
        withMockedDate(secondMailDatetime, () => sut.addMail(testMail));
    
        const remainingMails = sut.getMails();

        expect(remainingMails).toStrictEqual(
          [{...testMail, datetime: secondMailDatetime}]
        );
      });

      test('if configured, after configured duration', () => {
        const sut = new MailHandler('PT10S');

        withMockedDate(new Date('2020-01-01T00:00:00Z'), () => {
          sut.addMail(testMail);
        });

        const secondMailDatetime = new Date('2020-01-01T00:00:11Z');
        withMockedDate(secondMailDatetime, () => sut.addMail(testMail));
    
        const remainingMails = sut.getMails();

        expect(remainingMails).toStrictEqual(
          [{...testMail, datetime: secondMailDatetime}]
        );
      });
    });
  });

  describe('get mails', () => {

    test('if no mails exists, return empty', () => {

      const sut = new MailHandler();

      const receivedMails = sut.getMails();

      expect(receivedMails).toStrictEqual([]);
    });

    test('if mails exists, return mails', () => {

      const sut = new MailHandler();

      const mailAddingDateTime = new Date('2000-01-01');
      withMockedDate(mailAddingDateTime, () => {
        sut.addMail(testMail);
        sut.addMail(testMail);
        sut.addMail(testMail);
      });

      const receivedMails = sut.getMails();

      expect(receivedMails).toStrictEqual([
        {...testMail, datetime: mailAddingDateTime},
        {...testMail, datetime: mailAddingDateTime},
        {...testMail, datetime: mailAddingDateTime},
      ]);
    });

    describe('filter mails', () => {

      test('filter mails sent to given address', () => {

        const sut = new MailHandler();

        const mail = {
          'personalizations': [
            {
              'to': [{
                'email': 'sonic@hedgehog.com'
              }, {
                'email': 'tails@miles.com'
              }]
            }
          ],
          'subject': 'like the wind',        
        };

        const addedMailDateTime = new Date('2020-01-01');
        withMockedDate(addedMailDateTime, () => {
          sut.addMail(testMail);
          sut.addMail(mail);
        });

        const mailsReceivedInsufficientFilter= sut.getMails({to: 'sonic'});
        expect(mailsReceivedInsufficientFilter).toStrictEqual([]);

        const mailsReceivedNonExactMatch= sut.getMails({to: '%sonic%'});
        expect(mailsReceivedNonExactMatch).toStrictEqual(
          [{...mail, datetime: addedMailDateTime}]
        );

        const mailsReceivedExactMatch= sut.getMails({to: 'sonic@hedgehog.com'});
        expect(mailsReceivedExactMatch).toStrictEqual(
          [{...mail, datetime: addedMailDateTime}]
        );
      });

      test('filter mails sent with given subject', () => {

        const sut = new MailHandler();

        const mail = {
          'personalizations': [
            {
              'to': [{
                'email': 'sonic@hedgehog.com'
              }, {
                'email': 'tails@miles.com'
              }]
            }
          ],
          'subject': 'like the wind',
        };

        const addedMailDateTime = new Date('2020-01-01');
        withMockedDate(addedMailDateTime, () => {
          sut.addMail(testMail);
          sut.addMail(mail);
        });

        const mailsReceivedInsufficientFilter= sut.getMails({subject: 'like'});
        expect(mailsReceivedInsufficientFilter).toStrictEqual([]);

        const mailsReceivedNonExactMatch= sut.getMails({subject: '%like%'});
        expect(mailsReceivedNonExactMatch).toStrictEqual(
          [{...mail, datetime: addedMailDateTime}]
        );

        const mailsReceivedExactMatch= sut.getMails({subject: 'like the wind'});
        expect(mailsReceivedExactMatch).toStrictEqual(
          [{...mail, datetime: addedMailDateTime}]
        );
      });

      test('filter mails sent after a given point in time', () => {

        const sut = new MailHandler();

        const mail = {
          'personalizations': [
            {
              'to': [{
                'email': 'sonic@hedgehog.com'
              }, {
                'email': 'tails@miles.com'
              }]
            }
          ],
          'subject': 'like the wind',
        };

        withMockedDate(new Date('2020-01-01T00:00:00Z'), () => {
          sut.addMail(testMail);
        });

        const addedMailDateTime = new Date('2020-01-01T12:00:00Z');
        withMockedDate(addedMailDateTime, () => {
          sut.addMail(mail);
        });

        const mailsReceivedInsufficientFilter= sut.getMails({dateTimeSince: '2020-01-01T12:00:00Z'});
        expect(mailsReceivedInsufficientFilter).toStrictEqual([]);

        const mailsReceivedExactMatch = sut.getMails({dateTimeSince: '2020-01-01T11:59:59Z'});
        expect(mailsReceivedExactMatch).toStrictEqual(
          [{...mail, datetime: addedMailDateTime}]
        );
      });

      test('filter mails by multiple applied filter', () => {

        const sut = new MailHandler();

        const mail = {
          'personalizations': [
            {
              'to': [{
                'email': 'sonic@hedgehog.com'
              }, {
                'email': 'tails@miles.com'
              }]
            }
          ],
          'subject': 'like the wind',
        };

        const addedMailDateTime = new Date('2020-01-01');
        withMockedDate(addedMailDateTime, () => {
          sut.addMail(testMail);
          sut.addMail(mail);
        });

        expect(sut.getMails({
          to: '%sonic%', 
          subject: '%import%', 
          dateTimeSince: '2020-01-02'
        })).toStrictEqual([]);

        expect(sut.getMails({
          to: '%sonic%', 
          subject: '%wind%', 
          dateTimeSince: '2020-01-02'
        })).toStrictEqual([]);

        expect(sut.getMails({
          to: '%sonic%', 
          subject: 'like the wind', 
          dateTimeSince: '2019-12-31'
        })).toStrictEqual([
          {...mail, datetime: addedMailDateTime}
        ]);
      });
    });

    describe('paginate mails', () => {

      test('page size according to given page size', () => {

        const sut = new MailHandler();
    
        const addedMailDateTime = new Date('2020-01-01');
        withMockedDate(addedMailDateTime, () => {
          sut.addMail({...testMail, subject: '1'});
          sut.addMail({...testMail, subject: '2'});
          sut.addMail({...testMail, subject: '3'});
        });

        const pagedMails = sut.getMails({}, {pageSize: 1});

        expect(pagedMails).toStrictEqual([
          {...testMail, subject: '3', datetime: addedMailDateTime},
        ]);
      });

      test('page according to given page', () => {

        const sut = new MailHandler();
    
        const addedMailDateTime = new Date('2020-01-01');
        withMockedDate(addedMailDateTime, () => {
          sut.addMail({...testMail, subject: '1'});
          sut.addMail({...testMail, subject: '2'});
          sut.addMail({...testMail, subject: '3'});
        });

        const pagedMails = sut.getMails({}, {pageSize: 1, page: 3});

        expect(pagedMails).toStrictEqual([
          {...testMail, subject: '1', datetime: addedMailDateTime},
        ]);
      });
    });

    test('filter and paginate mails', () => {

      const sut = new MailHandler();

      const mail = {
        'personalizations': [
          {
            'to': [{
              'email': 'sonic@hedgehog.com'
            }, {
              'email': 'tails@miles.com'
            }]
          }
        ],
        'subject': 'like the wind',
      };

      const addedMailDateTime = new Date('2020-01-01');
      withMockedDate(addedMailDateTime, () => {
        sut.addMail(testMail);
        sut.addMail({...mail, subject: '1'});
        sut.addMail({...mail, subject: '2'});
      });

      const filteredAndPagedMails = sut.getMails(
        {
          to: '%sonic%', 
        },
        {
          pageSize: 1,
          page: 2
        });

      expect(filteredAndPagedMails).toStrictEqual([
        {...mail, subject: '1', datetime: addedMailDateTime},
      ]);
    });
  });

  describe('clear mails', () => {

    test('if no filter applied, clear all mails', () => {

      const sut = new MailHandler();

      sut.addMail(testMail);
      sut.addMail(testMail);
      sut.addMail(testMail);

      sut.clear();

      const remainingMails = sut.getMails();

      expect(remainingMails).toStrictEqual([]);
    });

    test('if filter applied, clear only out-filtered mails', () => {

      const sut = new MailHandler();

      const mail = {
        'personalizations': [
          {
            'to': [{
              'email': 'sonic@hedgehog.com'
            }, {
              'email': 'tails@miles.com'
            }]
          }
        ],
        'subject': 'like the wind',        
      };

      const addedMailDateTime = new Date('2020-01-01');
      withMockedDate(addedMailDateTime, () => {
        sut.addMail(testMail);
        sut.addMail(mail);
      });

      sut.clear({to: '%sonic%'});

      const remainingMails = sut.getMails();

      expect(remainingMails).toStrictEqual([
        {...testMail, datetime: addedMailDateTime},
      ]);
    });
  });
});
