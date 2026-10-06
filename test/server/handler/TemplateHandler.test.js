const TemplateHandler = require('../../../src/server/handler/TemplateHandler');

const upstreamTemplate = {
  id: 'd-123',
  name: 'Real template',
  versions: [{id: 'v1', active: 1, subject: 'Hello {{name}}'}],
};

const respond = (status, data) => Promise.resolve({status, data});

describe('TemplateHandler', () => {

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('without an api key', () => {

    test('returns an active stub version without calling SendGrid', async () => {

      const httpClient = {get: jest.fn()};
      const sut = new TemplateHandler({httpClient});

      const {status, body, source} = await sut.getTemplate('d-123');

      expect(status).toBe(200);
      expect(source).toBe('stub');
      expect(body.id).toBe('d-123');
      expect(body.versions.filter(version => version.active === 1).length).toBe(1);
      expect(typeof body.versions[0].subject).toBe('string');
      expect(httpClient.get).not.toHaveBeenCalled();
    });
  });

  describe('with an api key', () => {

    test('fetches from SendGrid with the key and returns the template unchanged', async () => {

      const httpClient = {get: jest.fn(() => respond(200, upstreamTemplate))};
      const sut = new TemplateHandler({apiKey: 'read-key', baseUrl: 'https://sg.example/v3/', httpClient});

      const result = await sut.getTemplate('d-123');

      expect(result).toStrictEqual({status: 200, body: upstreamTemplate, source: 'upstream'});
      expect(httpClient.get).toHaveBeenCalledTimes(1);
      const [url, options] = httpClient.get.mock.calls[0];
      expect(url).toBe('https://sg.example/v3/templates/d-123');
      expect(options.headers.Authorization).toBe('Bearer read-key');
    });

    test('serves from the cache until the ttl has passed', async () => {

      jest.useFakeTimers('modern');
      const httpClient = {get: jest.fn(() => respond(200, upstreamTemplate))};
      const sut = new TemplateHandler({apiKey: 'k', cacheTtl: 'PT10S', httpClient});

      await sut.getTemplate('d-123');
      jest.advanceTimersByTime(9000);
      expect((await sut.getTemplate('d-123')).source).toBe('cache');
      expect(httpClient.get).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(2000);
      expect((await sut.getTemplate('d-123')).source).toBe('upstream');
      expect(httpClient.get).toHaveBeenCalledTimes(2);
    });

    test('concurrent requests share one upstream call', async () => {

      const httpClient = {get: jest.fn(() => respond(200, upstreamTemplate))};
      const sut = new TemplateHandler({apiKey: 'k', httpClient});

      await Promise.all([sut.getTemplate('d-123'), sut.getTemplate('d-123'), sut.getTemplate('d-123')]);

      expect(httpClient.get).toHaveBeenCalledTimes(1);
    });

    test.each([404, 401, 403, 429])('passes %i through instead of stubbing', async (statusCode) => {

      const errorBody = {errors: [{message: 'nope'}]};
      const httpClient = {get: jest.fn(() => respond(statusCode, errorBody))};
      const sut = new TemplateHandler({apiKey: 'k', httpClient});

      expect(await sut.getTemplate('d-123')).toStrictEqual({status: statusCode, body: errorBody, source: 'upstream'});
    });

    test('does not cache error answers', async () => {

      const httpClient = {get: jest.fn()
        .mockReturnValueOnce(respond(404, {}))
        .mockReturnValueOnce(respond(200, upstreamTemplate))};
      const sut = new TemplateHandler({apiKey: 'k', httpClient});

      await sut.getTemplate('d-123');

      expect((await sut.getTemplate('d-123')).source).toBe('upstream');
    });

    test.each([
      ['a network error', () => Promise.reject(new Error('ECONNREFUSED'))],
      ['a 5xx answer', () => respond(503, {})],
    ])('on %s with nothing cached returns the stub', async (_, failure) => {

      const sut = new TemplateHandler({apiKey: 'k', httpClient: {get: jest.fn(failure)}});

      const {status, source, body} = await sut.getTemplate('d-123');

      expect(status).toBe(200);
      expect(source).toBe('stub');
      expect(body.versions[0].active).toBe(1);
    });

    test('on failure after the ttl returns the stale cached template', async () => {

      jest.useFakeTimers('modern');
      const httpClient = {get: jest.fn()
        .mockReturnValueOnce(respond(200, upstreamTemplate))
        .mockReturnValueOnce(Promise.reject(new Error('timeout')))};
      const sut = new TemplateHandler({apiKey: 'k', cacheTtl: 'PT10S', httpClient});

      await sut.getTemplate('d-123');
      jest.advanceTimersByTime(11000);

      expect(await sut.getTemplate('d-123')).toStrictEqual({status: 200, body: upstreamTemplate, source: 'stale'});
    });
  });

  test.each(['../etc/passwd', 'a/b', 'a?b=c', 'a b', ''])('rejects invalid template id "%s"', async (id) => {

    const httpClient = {get: jest.fn()};
    const sut = new TemplateHandler({apiKey: 'k', httpClient});

    const result = await sut.getTemplate(id);

    expect(result.status).toBe(400);
    expect(httpClient.get).not.toHaveBeenCalled();
  });
});
