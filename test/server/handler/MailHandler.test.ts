import MailHandler from '../../../src/server/handler/MailHandler';
import axios from 'axios';
import {withMockedDate } from '../../MockDate';
import crypto from 'crypto';
import { Mail } from '@/types/Mail.ts';

jest.mock('axios');

const testMail: Mail = {
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
  'categories': ['important']
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

      const mail: Mail = {
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

  describe('delivery events', () => {
    describe('add mail sends when EVENT_DELIVERY_URL is set', () => {

      beforeAll(() => {
        process.env.EVENT_DELIVERY_URL = 'http://example.com';
      });

      beforeEach(() => {
        jest.clearAllMocks();
      });

      test('send delivery events', () => {
        const sut = new MailHandler();

        (axios.post as jest.Mock).mockResolvedValue({data: {message: 'success'}});

        const messageId = crypto.randomUUID();

        sut.addMail(testMail, messageId);

        expect((axios.post as jest.Mock).mock.calls[0][0]).toEqual(process.env.EVENT_DELIVERY_URL);
        const eventData = (axios.post as jest.Mock).mock.calls[0][1];
        expect(eventData.length).toBe(2);
        expect(eventData[0]).toMatchObject({
          email: testMail.personalizations?.[0].to?.[0].email,
          event: 'delivered',
          timestamp: expect.any(Number),
          sg_event_id: expect.any(String),
          sg_message_id: messageId,
          'smtp-id': expect.any(String),
          category: expect.any(Array)
        });
      });

      test('send delivery events with defaulted messageId', () => {
        const sut = new MailHandler();

        (axios.post as jest.Mock).mockResolvedValue({data: {message: 'success'}});

        sut.addMail(testMail);

        expect((axios.post as jest.Mock).mock.calls[0][0]).toEqual(process.env.EVENT_DELIVERY_URL);
        const eventData = (axios.post as jest.Mock).mock.calls[0][1];
        expect(eventData.length).toBe(2);
        expect(eventData[0]).toMatchObject({
          sg_message_id: expect.any(String),
        });
      });

      describe('send delivery events with categories', () => {

        test('single category array is returned as an array', () => {
          const sut = new MailHandler();

          (axios.post as jest.Mock).mockResolvedValue({data: {message: 'success'}});

          sut.addMail(testMail);

          expect((axios.post as jest.Mock).mock.calls[0][0]).toEqual(process.env.EVENT_DELIVERY_URL);
          const eventData = (axios.post as jest.Mock).mock.calls[0][1];
          expect(eventData.length).toBe(2);
          expect(eventData[0]).toMatchObject({
            category: ['important']
          });
        });

        test('without categories returns empty array', () => {
          const mailWithoutCategories = {
            ...testMail,
          };
          delete mailWithoutCategories.categories;
          const sut = new MailHandler();

          (axios.post as jest.Mock).mockResolvedValue({data: {message: 'success'}});

          sut.addMail(mailWithoutCategories);

          expect((axios.post as jest.Mock).mock.calls[0][0]).toEqual(process.env.EVENT_DELIVERY_URL);
          const eventData = (axios.post as jest.Mock).mock.calls[0][1];
          expect(eventData.length).toBe(2);
          expect(eventData[0]).toMatchObject({
            category: [],
          });
        });
      });

      describe('send delivery events with custom args at the request level', () => {
        test('custom args are added to the event', () => {
          const customArgs = {
            'user_id': '12345',
            'purchase': 'gold'
          };
          const sut = new MailHandler();

          (axios.post as jest.Mock).mockResolvedValue({data: {message: 'success'}});

          sut.addMail({...testMail, custom_args: customArgs});

          expect((axios.post as jest.Mock).mock.calls[0][0]).toEqual(process.env.EVENT_DELIVERY_URL);
          const eventData = (axios.post as jest.Mock).mock.calls[0][1];
          expect(eventData.length).toBe(2);

          expect(eventData[0]['user_id']).toEqual('12345');
          expect(eventData[0]['purchase']).toEqual('gold');

          expect(eventData[1]['user_id']).toEqual('12345');
          expect(eventData[1]['purchase']).toEqual('gold');
        });

        test('custom args do not override reserved fields', () => {
          const customArgs = {
            'email': '12345',
            'timestamp': 12345,
            'event': 'test',
            'sg_event_id': '12345',
            'sg_message_id': '12345',
            'category': 'test',
            'smtp-id': '12345',
            'id': '67890'
          };

          const sut = new MailHandler();

          (axios.post as jest.Mock).mockResolvedValue({data: {message: 'success'}});

          sut.addMail({...testMail, custom_args: customArgs});

          expect((axios.post as jest.Mock).mock.calls[0][0]).toEqual(process.env.EVENT_DELIVERY_URL);

          const eventData = (axios.post as jest.Mock).mock.calls[0][1];
          expect(eventData.length).toBe(2);

          expect(eventData[0]['email']).toEqual('to@example.com');
          expect(eventData[0]['timestamp']).not.toEqual(12345);
          expect(eventData[0]['event']).toEqual('delivered');
          expect(eventData[0]['sg_event_id']).not.toEqual('12345');
          expect(eventData[0]['sg_message_id']).not.toEqual('12345');
          expect(eventData[0]['category']).not.toEqual('test');
          expect(eventData[0]['smtp-id']).not.toEqual('12345');
          expect(eventData[0]['id']).toEqual('67890');

          expect(eventData[1]['email']).toEqual('to2@example.com');
          expect(eventData[1]['timestamp']).not.toEqual(12345);
          expect(eventData[1]['event']).toEqual('delivered');
          expect(eventData[1]['sg_event_id']).not.toEqual('12345');
          expect(eventData[1]['sg_message_id']).not.toEqual('12345');
          expect(eventData[1]['category']).not.toEqual('test');
          expect(eventData[1]['smtp-id']).not.toEqual('12345');
          expect(eventData[1]['id']).toEqual('67890');
        });
      });

      describe('send delivery events with custom args at the personalization level', () => {
        test('custom args are added to the event', () => {
          const mailWithCustomArgs: Mail = {...testMail};

          // @ts-ignore
          mailWithCustomArgs.personalizations[0]['custom_args'] = {
            'user_id': '2455',
            'purchase': 'gold'
          };

          const sut = new MailHandler();

          (axios.post as jest.Mock).mockResolvedValue({data: {message: 'success'}});

          sut.addMail(mailWithCustomArgs);

          expect((axios.post as jest.Mock).mock.calls[0][0]).toEqual(process.env.EVENT_DELIVERY_URL);
          const eventData = (axios.post as jest.Mock).mock.calls[0][1];
          expect(eventData.length).toBe(2);

          expect(eventData[0]['user_id']).toEqual('2455');
          expect(eventData[0]['purchase']).toEqual('gold');
        });

        test('personalization custom args override mail custom args', () => {
          const mailWithCustomArgs = {...testMail};

          // @ts-ignore
          mailWithCustomArgs['personalizations'][0]['custom_args'] = {
            'user_id': '2455',
            'purchase': 'gold'
          };

          mailWithCustomArgs.custom_args = {
            'user_id': '12345',
            'purchase': 'silver'
          };

          const sut = new MailHandler();

          (axios.post as jest.Mock).mockResolvedValue({data: {message: 'success'}});

          sut.addMail(mailWithCustomArgs);

          expect((axios.post as jest.Mock).mock.calls[0][0]).toEqual(process.env.EVENT_DELIVERY_URL);
          const eventData = (axios.post as jest.Mock).mock.calls[0][1];
          expect(eventData.length).toBe(2);

          expect(eventData[0]['user_id']).toEqual('2455');
          expect(eventData[0]['purchase']).toEqual('gold');
        });

        test('personalization custom args do not override reserved fields', () => {
          const mailWithCustomArgs = {...testMail};

          // @ts-ignore
          mailWithCustomArgs['personalizations'][0]['custom_args'] = {
            'email': '12345',
            'timestamp': 12345,
            'event': 'test',
            'sg_event_id': '12345',
            'sg_message_id': '12345',
            'category': 'test',
            'smtp-id': '12345',
            'id': '67890'
          };

          const sut = new MailHandler();

          (axios.post as jest.Mock).mockResolvedValue({data: {message: 'success'}});

          sut.addMail(mailWithCustomArgs);

          expect((axios.post as jest.Mock).mock.calls[0][0]).toEqual(process.env.EVENT_DELIVERY_URL);
          const eventData = (axios.post as jest.Mock).mock.calls[0][1];
          expect(eventData.length).toBe(2);

          expect(eventData[0]['email']).toEqual('to@example.com');
          expect(eventData[0]['timestamp']).not.toEqual(12345);
          expect(eventData[0]['event']).toEqual('delivered');
          expect(eventData[0]['sg_event_id']).not.toEqual('12345');
          expect(eventData[0]['sg_message_id']).not.toEqual('12345');
          expect(eventData[0]['category']).not.toEqual('test');
          expect(eventData[0]['smtp-id']).not.toEqual('12345');
          expect(eventData[0]['id']).toEqual('67890');
        });
      });
    });
  });
});
