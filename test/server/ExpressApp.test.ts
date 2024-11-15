import request from 'supertest';
import sinon from 'sinon';
import {setupExpressApp} from '../../src/server/ExpressApp';
import MailHandler from '../../src/server/handler/MailHandler';

const rateLimitConfiguration = {enabled: false};

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
      'type': 'text/html',
      'value': 'even more important content containing a link <a href="http://example.com/path?query=value">http://example.com/path?query=value</a>'
    }
  ]
};

const testMailWithTemplateId = {
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
  'template_id': 'test-template-id'
};

describe('App', () => {

  describe('POST /v3/mail/send', () => {

    test('adds mails', async () => {

      const mailHandlerStub = sinon.createStubInstance(MailHandler);
      mailHandlerStub
        .addMail
        .withArgs(
          sinon.match(testMail)
        )
        .returns(undefined);

      const sut = setupExpressApp(mailHandlerStub, { enabled: false }, 'sonic', rateLimitConfiguration);

      const response = await request(sut)
        .post('/v3/mail/send')
        .send(testMail)
        .set('Authorization', 'Bearer sonic');

      expect(response.statusCode).toBe(202);
    });

    test('adds mail with template ID', async () => {

      const mailHandlerStub = sinon.createStubInstance(MailHandler);
      mailHandlerStub
        .addMail
        .withArgs(
          sinon.match(testMail)
        )
        .returns(undefined);

      const sut = setupExpressApp(mailHandlerStub, { enabled: false }, 'sonic', rateLimitConfiguration);

      const response = await request(sut)
        .post('/v3/mail/send')
        .send(testMailWithTemplateId)
        .set('Authorization', 'Bearer sonic');

      expect(response.statusCode).toBe(202);
    });

    test('responds with x-message-id header', async () => {

      const mailHandlerStub = sinon.createStubInstance(MailHandler);
      mailHandlerStub
        .addMail
        .withArgs(
          sinon.match(testMail)
        )
        .returns(undefined);

      const sut = setupExpressApp(mailHandlerStub, { enabled: false }, 'sonic', rateLimitConfiguration);

      const response = await request(sut)
        .post('/v3/mail/send')
        .send(testMail)
        .set('Authorization', 'Bearer sonic');

      expect(response.headers['x-message-id']).toBeDefined();
    });

    test('blocks not authenticated user ', async () => {

      const mailHandlerStub = sinon.createStubInstance(MailHandler);

      const sut = setupExpressApp(mailHandlerStub, {enabled: false}, 'sonic', rateLimitConfiguration);

      const response = await request(sut).post('/v3/mail/send').send(testMail);
      expect(response.statusCode).toBe(403);
    });

    test('pass through authenticated user ', async () => {

      const mailHandlerStub = sinon.createStubInstance(MailHandler);

      const sut = setupExpressApp(mailHandlerStub, {enabled: false}, 'sonic', rateLimitConfiguration);

      const response = await request(sut)
        .post('/v3/mail/send')
        .send(testMail)
        .set('Authorization', 'Bearer sonic');

      expect(response.statusCode).toBe(202);
    });

    test('basic auth does not apply to api endpoints', async () => {
      const mailHandlerStub = sinon.createStubInstance(MailHandler);

      const sut = setupExpressApp(
          mailHandlerStub,
          {enabled: true, users: {shadow: 'the password'}},
          'sonic',
          rateLimitConfiguration
        );

      const response = await request(sut)
        .post('/v3/mail/send')
        .send(testMail)
        .set('Authorization', 'Bearer sonic')

      expect(response.statusCode).toBe(202);
    });

    test('accepts name as null', async () => {
      const mailWithNameNull = {
        ...testMail,
        'from': {
          'email': 'from@example.com',
          'name': null
        }
      };

      const mailHandlerStub = sinon.createStubInstance(MailHandler);
      const sut = setupExpressApp(mailHandlerStub, { enabled: false }, 'sonic', rateLimitConfiguration);

      const response = await request(sut)
        .post('/v3/mail/send')
        .send(mailWithNameNull)
        .set('Authorization', 'Bearer sonic');

      expect(response.statusCode).toBe(202);
    });

    test('accepts name as string', async () => {
      const mailWithNameString = {
        ...testMail,
        'from': {
          'email': 'from@example.com',
          'name': 'Valid Name'
        }
      };

      const mailHandlerStub = sinon.createStubInstance(MailHandler);
      const sut = setupExpressApp(mailHandlerStub, { enabled: false }, 'sonic', rateLimitConfiguration);

      const response = await request(sut)
        .post('/v3/mail/send')
        .send(mailWithNameString)
        .set('Authorization', 'Bearer sonic');

      expect(response.statusCode).toBe(202);
    });

    test('rejects name of incorrect type', async () => {
      const mailWithInvalidName = {
        ...testMail,
        'from': {
          'email': 'from@example.com',
          'name': 123
        }
      };

      const mailHandlerStub = sinon.createStubInstance(MailHandler);
      const sut = setupExpressApp(mailHandlerStub, { enabled: false }, 'sonic', rateLimitConfiguration);

      const response = await request(sut)
        .post('/v3/mail/send')
        .send(mailWithInvalidName)
        .set('Authorization', 'Bearer sonic');

      expect(response.statusCode).toBe(400);
    });

    test('accepts categories as null', async () => {
      const mailWithCategoriesNull = {
        ...testMail,
        'categories': null
      };

      const mailHandlerStub = sinon.createStubInstance(MailHandler);
      const sut = setupExpressApp(mailHandlerStub, { enabled: false }, 'sonic', rateLimitConfiguration);

      const response = await request(sut)
        .post('/v3/mail/send')
        .send(mailWithCategoriesNull)
        .set('Authorization', 'Bearer sonic');

      expect(response.statusCode).toBe(202);
    });

    test('accepts categories as array', async () => {
      const mailWithCategoriesArray = {
        ...testMail,
        'categories': ['category1', 'category2']
      };

      const mailHandlerStub = sinon.createStubInstance(MailHandler);
      const sut = setupExpressApp(mailHandlerStub, { enabled: false }, 'sonic', rateLimitConfiguration);

      const response = await request(sut)
        .post('/v3/mail/send')
        .send(mailWithCategoriesArray)
        .set('Authorization', 'Bearer sonic');

      expect(response.statusCode).toBe(202);
    });

    test('rejects categories of incorrect type', async () => {
      const mailWithInvalidCategories = {
        ...testMail,
        'categories': {
          'bad': 'data'
        }
      };

      const mailHandlerStub = sinon.createStubInstance(MailHandler);
      const sut = setupExpressApp(mailHandlerStub, { enabled: false }, 'sonic', rateLimitConfiguration);

      const response = await request(sut)
        .post('/v3/mail/send')
        .send(mailWithInvalidCategories)
        .set('Authorization', 'Bearer sonic');

      expect(response.statusCode).toBe(400);
    });

    test('accepts custom args as an object', async () => {
      const mailWithCustomArgs = {
        ...testMail,
        'custom_args': {
          'key': 'value'
        }
      };

      const mailHandlerStub = sinon.createStubInstance(MailHandler);
      const sut = setupExpressApp(mailHandlerStub, { enabled: false }, 'sonic', rateLimitConfiguration);

      const response = await request(sut)
        .post('/v3/mail/send')
        .send(mailWithCustomArgs)
        .set('Authorization', 'Bearer sonic');

      expect(response.statusCode).toBe(202);
    });

    test('rejects custom args of incorrect type', async () => {
      const mailWithInvalidCustomArgs = {
        ...testMail,
        'custom_args': ['invalid']
      };

      const mailHandlerStub = sinon.createStubInstance(MailHandler);
      const sut = setupExpressApp(mailHandlerStub, { enabled: false }, 'sonic', rateLimitConfiguration);

      const response = await request(sut)
        .post('/v3/mail/send')
        .send(mailWithInvalidCustomArgs)
        .set('Authorization', 'Bearer sonic');

      expect(response.statusCode).toBe(400);
    });

    test('accepts custom args as null', async () => {
      const mailWithCustomArgsNull = {
        ...testMail,
        'custom_args': null
      };

      const mailHandlerStub = sinon.createStubInstance(MailHandler);
      const sut = setupExpressApp(mailHandlerStub, { enabled: false }, 'sonic', rateLimitConfiguration);

      const response = await request(sut)
        .post('/v3/mail/send')
        .send(mailWithCustomArgsNull)
        .set('Authorization', 'Bearer sonic');

      expect(response.statusCode).toBe(202);
    });

    test('accepts custom args at the personalization level', async () => {
      const personalizedCustomArgs = {
        'key': 'value'
      };

      const mailWithPersonalizedCustomArgs = testMail;
      // @ts-ignore
      mailWithPersonalizedCustomArgs.personalizations[0]['custom_args'] = personalizedCustomArgs;

      const mailHandlerStub = sinon.createStubInstance(MailHandler);
      const sut = setupExpressApp(mailHandlerStub, { enabled: false }, 'sonic', rateLimitConfiguration);

      const response = await request(sut)
        .post('/v3/mail/send')
        .send(mailWithPersonalizedCustomArgs)
        .set('Authorization', 'Bearer sonic');

      expect(response.statusCode).toBe(202);
    });

    test('rejects custom args at the personalization level of incorrect type', async () => {
      const personalizedCustomArgs = ['invalid'];

      const mailWithInvalidPersonalizedCustomArgs = testMail;
      // @ts-ignore
      mailWithInvalidPersonalizedCustomArgs.personalizations[0]['custom_args'] = personalizedCustomArgs;

      const mailHandlerStub = sinon.createStubInstance(MailHandler);
      const sut = setupExpressApp(mailHandlerStub, { enabled: false }, 'sonic', rateLimitConfiguration);

      const response = await request(sut)
        .post('/v3/mail/send')
        .send(mailWithInvalidPersonalizedCustomArgs)
        .set('Authorization', 'Bearer sonic');

      expect(response.statusCode).toBe(400);
    });

    test('accepts custom args at the personalization level as null', async () => {
      const mailWithPersonalizedCustomArgsNull = testMail;
      // @ts-ignore
      mailWithPersonalizedCustomArgsNull.personalizations[0]['custom_args'] = null;

      const mailHandlerStub = sinon.createStubInstance(MailHandler);
      const sut = setupExpressApp(mailHandlerStub, { enabled: false }, 'sonic', rateLimitConfiguration);

      const response = await request(sut)
        .post('/v3/mail/send')
        .send(mailWithPersonalizedCustomArgsNull)
        .set('Authorization', 'Bearer sonic');

      expect(response.statusCode).toBe(202);
    });
  });

  describe('GET /api/mails', () => {

    const testGetMails = (url: string) => {
      return async (expectedFilterCriteria: any, expectedPaginationCriteria: any) => {

        const mailHandlerStub = sinon.createStubInstance(MailHandler);
        mailHandlerStub
          .getMails
          .withArgs(
            sinon.match(expectedFilterCriteria),
            sinon.match(expectedPaginationCriteria)
          )
          .returns([testMail]);

        const sut = setupExpressApp(mailHandlerStub, { enabled: false }, undefined, rateLimitConfiguration);

        const response = await request(sut).get(url);

        expect(response.statusCode).toBe(200);
        expect(response.body).toStrictEqual([testMail]);
      };
    };

    test('get mails', async () => {

      await testGetMails('/api/mails')({}, {});
    });

    test('get mails with provided filter criteria', async () => {

      await testGetMails('/api/mails?to=receiver&subject=important&dateTimeSince=2000')(
        sinon.match({to: 'receiver', subject: 'important', dateTimeSince: '2000'}),
        sinon.match({})
      );
    });

    test('get mails with provided pagination criteria', async () => {

      await testGetMails('/api/mails?pageSize=20&page=10')(
        sinon.match({to: undefined, subject: undefined, dateTimeSince: undefined}),
        sinon.match({pageSize: 20, page: 10})
      );
    });

    test('get mails with provided filter and pagination criteria', async () => {

      await testGetMails('/api/mails?pageSize=20&page=10&to=receiver')(
        sinon.match({to: 'receiver'}),
        sinon.match({pageSize: 20})
      );
    });

    describe('when authentication enabled', () => {
      test('basic auth does not apply to api endpoints', async () => {
        const mailHandlerStub = sinon.createStubInstance(MailHandler);

        const sut = setupExpressApp(
            mailHandlerStub,
            {enabled: true, users: {sonic: 'the password'}},
            undefined,
            rateLimitConfiguration
          );

        const response = await request(sut)
          .get('/api/mails')
          .auth('shadow', 'not the password');

        const responseNoAuth = await request(sut)
          .get('/api/mails');

        expect(response.statusCode).toBe(200);
        expect(responseNoAuth.statusCode).toBe(200);
      });
    });
  });

  describe('DELETE /api/mails', () => {

    const testDeleteMails = (url: string) => {
      return async (expectedFilterCriteria: any) => {

        const mailHandlerStub = sinon.createStubInstance(MailHandler);
        mailHandlerStub
          .clear
          .withArgs(
            sinon.match(expectedFilterCriteria),
          )
          .returns(undefined);

        const sut = setupExpressApp(mailHandlerStub, { enabled: false }, undefined, rateLimitConfiguration);

        const response = await request(sut).delete(url);

        expect(response.statusCode).toBe(202);
      };
    };

    test('clear mails', async () => {

      await testDeleteMails('/api/mails')({});
    });

    test('clear mails with provided filter criteria', async () => {

      await testDeleteMails('/api/mails?to=receiver')(
        sinon.match({to: 'receiver'})
      );
    });

    describe('when authentication enabled', () => {
      test('basic auth does not apply to api endpoints', async () => {
        const mailHandlerStub = sinon.createStubInstance(MailHandler);

        const sut = setupExpressApp(
            mailHandlerStub,
            {enabled: true, users: {sonic: 'the password'}},
            undefined,
            rateLimitConfiguration
          );

        const response = await request(sut)
          .delete('/api/mails')
          .auth('shadow', 'not the password');

        const responseNoAuth = await request(sut)
          .delete('/api/mails');

        expect(response.statusCode).toBe(202);
        expect(responseNoAuth.statusCode).toBe(202);
      });
    });
  });
});
