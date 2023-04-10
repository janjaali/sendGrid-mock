const request = require('supertest');
const sinon = require('sinon');

const {setupExpressApp} = require('../../src/server/ExpressApp');
const MailHandler = require('../../src/server/handler/MailHandler');

const rateLimitConfiguration = {enabled: false};

describe('App', () => {

  describe('POST /v3/mail/send', () => {

    test('adds mails', async () => {

      const mail = {mail: 'important'};

      const mailHandlerStub = sinon.createStubInstance(MailHandler);
      mailHandlerStub
        .addMail
        .withArgs(
          sinon.match(mail) 
        )
        .returns(undefined);
      
      const sut = setupExpressApp(mailHandlerStub, { enabled: false }, 'sonic', rateLimitConfiguration);

      const response = await request(sut)
        .post('/v3/mail/send')
        .send(mail)
        .set('Authorization', 'Bearer sonic');
      
      expect(response.statusCode).toBe(202);
    });

    test('responds with x-message-id header', async () => {

      const mail = {mail: 'important'};

      const mailHandlerStub = sinon.createStubInstance(MailHandler);
      mailHandlerStub
        .addMail
        .withArgs(
          sinon.match(mail) 
        )
        .returns(undefined);
      
      const sut = setupExpressApp(mailHandlerStub, { enabled: false }, 'sonic', rateLimitConfiguration);

      const response = await request(sut)
        .post('/v3/mail/send')
        .send(mail)
        .set('Authorization', 'Bearer sonic');
      
      expect(response.headers['x-message-id']).toBeDefined();
    });

    test('blocks not authenticated user ', async () => {

      const mailHandlerStub = sinon.createStubInstance(MailHandler);

      const sut = setupExpressApp(mailHandlerStub, {enabled: false}, 'sonic', rateLimitConfiguration);

      const response = await request(sut).post('/v3/mail/send');
      expect(response.statusCode).toBe(403);        
    });

    test('pass through authenticated user ', async () => {

      const mailHandlerStub = sinon.createStubInstance(MailHandler);

      const sut = setupExpressApp(mailHandlerStub, {enabled: false}, 'sonic', rateLimitConfiguration);

      const response = await request(sut)
        .post('/v3/mail/send')
        .set('Authorization', 'Bearer sonic');

      expect(response.statusCode).toBe(202);        
    });
  });

  describe('GET /api/mails', () => {

    const testGetMails = (url) => {
      return async (expectedFilterCriteria, expectedPaginationCriteria) => {

        const mailHandlerStub = sinon.createStubInstance(MailHandler);
        mailHandlerStub
          .getMails
          .withArgs(
            sinon.match(expectedFilterCriteria), 
            sinon.match(expectedPaginationCriteria)
          )
          .returns(['mail']);
        
        const sut = setupExpressApp(mailHandlerStub, { enabled: false }, undefined, rateLimitConfiguration);
  
        const response = await request(sut).get(url);
        
        expect(response.statusCode).toBe(200);
        expect(response.body).toStrictEqual(['mail']);
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
        sinon.match({}), 
        sinon.match({pageSize: '20', page: '10'})
      );
    });

    test('get mails with provided filter and pagination criteria', async () => {

      await testGetMails('/api/mails?pageSize=20&page=10&to=receiver')(
        sinon.match({to: 'receiver'}), 
        sinon.match({pageSize: '20'})
      );
    });

    describe('when authentication enabled', () => {

      test('blocks not authenticated user ', async () => {

        const mailHandlerStub = sinon.createStubInstance(MailHandler);

        const sut = setupExpressApp(mailHandlerStub, {enabled: true}, undefined, rateLimitConfiguration);
  
        const response = await request(sut).get('/api/mails');
        expect(response.statusCode).toBe(401);        
      });

      test('pass through authenticated user ', async () => {

        const mailHandlerStub = sinon.createStubInstance(MailHandler);

        const sut = setupExpressApp(
          mailHandlerStub, 
          {enabled: true, users: {sonic: 'the password'}},
          undefined,
          rateLimitConfiguration,
        );
  
        const response = await request(sut)
          .get('/api/mails')
          .auth('sonic', 'the password');

        expect(response.statusCode).toBe(200);        
      });
    });
  });

  describe('DELETE /api/mails', () => {
    
    const testDeleteMails = (url) => {
      return async (expectedFilterCriteria) => {

        const mailHandlerStub = sinon.createStubInstance(MailHandler);
        mailHandlerStub
          .clear
          .withArgs(
            sinon.match(expectedFilterCriteria) 
          )
          .returns(undefined);
        
        const sut = setupExpressApp(mailHandlerStub, { enabled: false }, undefined, rateLimitConfiguration);
  
        const response = await request(sut).delete(url);
        
        expect(response.statusCode).toBe(202);
      };
    };

    test('clear mails', async () => {

      await testDeleteMails('/api/mails')({}, {});
    });

    test('clear mails with provided filter criteria', async () => {

      await testDeleteMails('/api/mails?to=receiver')(
        sinon.match({to: 'receiver'}), 
        sinon.match({})
      );
    });

    describe('when authentication enabled', () => {

      test('blocks not authenticated user ', async () => {

        const mailHandlerStub = sinon.createStubInstance(MailHandler);

        const sut = setupExpressApp(mailHandlerStub, {enabled: true}, undefined, rateLimitConfiguration);
  
        const response = await request(sut).delete('/api/mails');
        expect(response.statusCode).toBe(401);        
      });

      test('pass through authenticated user ', async () => {

        const mailHandlerStub = sinon.createStubInstance(MailHandler);

        const sut = setupExpressApp(
          mailHandlerStub, 
          {enabled: true, users: {sonic: 'the password'}},
          undefined,
          rateLimitConfiguration,
        );
  
        const response = await request(sut)
          .delete('/api/mails')
          .auth('sonic', 'the password');

        expect(response.statusCode).toBe(202);        
      });
    });
  });
});
