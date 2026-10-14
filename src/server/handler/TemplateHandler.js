const axios = require('axios');

const {loggerFactory} = require('../logger/log4js');
const {parseDurationStringAsSeconds} = require('../util/duration');

const logger = loggerFactory('TemplateHandler');

const DEFAULT_BASE_URL = 'https://api.sendgrid.com/v3';
const DEFAULT_CACHE_TTL = 'PT1H';
const REQUEST_TIMEOUT_IN_MS = 5000;

// SendGrid template ids look like 'd-<hex>' (dynamic) or a uuid (legacy).
const VALID_TEMPLATE_ID = /^[\w-]+$/;

// The query parameters of SendGrid's `GET /v3/templates`. Anything else is dropped.
const LIST_QUERY_PARAMS = ['generations', 'page_size', 'page_token'];

const stubTemplate = (templateId) => ({
  id: templateId,
  name: `Mock template ${templateId}`,
  generation: 'dynamic',
  updated_at: new Date().toISOString(),
  versions: [
    {
      id: 'mock-version',
      template_id: templateId,
      active: 1,
      name: 'Mock version',
      subject: 'Mock subject',
      updated_at: new Date().toISOString(),
    },
  ],
});

/**
 * Serves SendGrid template information (`GET /v3/templates/:id` and
 * `GET /v3/templates`).
 *
 * If a read-only SendGrid API key is configured templates are fetched from
 * SendGrid and cached. Without a key, or if SendGrid cannot be reached and
 * nothing is cached, a generic stub is returned so that senders depending on
 * the template lookup keep working.
 */
class TemplateHandler {

  #apiKey;

  #baseUrl;

  #cacheTtlInMs;

  #httpClient;

  #stubTemplateIds;

  #cache = new Map();

  #inFlight = new Map();

  constructor({apiKey, baseUrl, cacheTtl, stubTemplateIds = [], httpClient = axios} = {}) {

    this.#apiKey = apiKey;
    this.#baseUrl = (baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.#cacheTtlInMs = parseDurationStringAsSeconds(cacheTtl || DEFAULT_CACHE_TTL) * 1000;
    this.#stubTemplateIds = stubTemplateIds.filter(id => VALID_TEMPLATE_ID.test(id));
    this.#httpClient = httpClient;

    if (this.#apiKey) {
      logger.info(`Fetching templates from ${this.#baseUrl}, cached for ${this.#cacheTtlInMs / 1000}s.`);
    } else {
      logger.warn('No template API key configured, serving stub templates.');
    }
  }

  /**
   * @returns {Promise<{status: number, body: object, source: string}>} source is one of
   * `invalid`, `cache`, `upstream`, `stale`, `stub`.
   */
  async getTemplate(templateId) {

    if (!VALID_TEMPLATE_ID.test(templateId)) {
      return {
        status: 400,
        body: {errors: [{message: 'invalid template id', field: 'template_id'}]},
        source: 'invalid',
      };
    }

    return this.#cachedFetch({
      cacheKey: `template:${templateId}`,
      url: `${this.#baseUrl}/templates/${encodeURIComponent(templateId)}`,
      what: `template ${templateId}`,
      stub: () => stubTemplate(templateId),
    });
  }

  /**
   * Lists templates like SendGrid's `GET /v3/templates`.
   *
   * Without an api key the stub list holds the configured stub template ids and
   * never has a next page, so clients that page until `_metadata.next` is empty
   * stop after one request. Page links from SendGrid are rewritten to `mockBaseUrl`
   * when it is given, so clients that follow them keep talking to the mock.
   *
   * @param {object} query request query; only `generations`, `page_size` and `page_token` are used
   * @param {string} [mockBaseUrl] the mock's own `.../v3` url
   * @returns {Promise<{status: number, body: object, source: string}>}
   */
  async listTemplates(query = {}, mockBaseUrl) {

    const params = {};
    LIST_QUERY_PARAMS
      .filter(name => typeof query[name] === 'string' && query[name] !== '')
      .forEach(name => { params[name] = query[name]; });

    const result = await this.#cachedFetch({
      cacheKey: `list:${new URLSearchParams(params).toString()}`,
      url: `${this.#baseUrl}/templates`,
      params,
      what: 'the template list',
      stub: () => this.#stubTemplateList(params.generations),
    });

    if (result.status !== 200 || !mockBaseUrl) {
      return result;
    }

    return {...result, body: this.#withLinksTo(result.body, mockBaseUrl.replace(/\/+$/, ''))};
  }

  #stubTemplateList(generations) {

    // Stub templates are dynamic, so they are only listed when dynamic templates are asked for.
    const wanted = generations ? generations.split(',').map(g => g.trim()) : ['legacy'];
    const result = wanted.includes('dynamic') ? this.#stubTemplateIds.map(stubTemplate) : [];

    return {result, _metadata: {count: result.length}};
  }

  #withLinksTo(body, mockBaseUrl) {

    const metadata = body && body._metadata;
    if (!metadata) {
      return body;
    }

    const rewritten = {...metadata};
    ['self', 'prev', 'next'].forEach(link => {
      if (typeof rewritten[link] === 'string' && rewritten[link].startsWith(this.#baseUrl)) {
        rewritten[link] = mockBaseUrl + rewritten[link].slice(this.#baseUrl.length);
      }
    });

    return {...body, _metadata: rewritten};
  }

  async #cachedFetch({cacheKey, url, params, what, stub}) {

    const cached = this.#cache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < this.#cacheTtlInMs) {
      return {status: 200, body: cached.body, source: 'cache'};
    }

    if (!this.#apiKey) {
      return {status: 200, body: stub(), source: 'stub'};
    }

    // Share one upstream request between concurrent requests for the same thing.
    if (!this.#inFlight.has(cacheKey)) {
      const request = this.#fetchFromUpstream({cacheKey, url, params, what, stub}, cached)
        .finally(() => this.#inFlight.delete(cacheKey));
      this.#inFlight.set(cacheKey, request);
    }

    return this.#inFlight.get(cacheKey);
  }

  async #fetchFromUpstream({cacheKey, url, params, what, stub}, cached) {

    try {
      const response = await this.#httpClient.get(url, {
        headers: {Authorization: `Bearer ${this.#apiKey}`},
        ...(params ? {params} : {}),
        timeout: REQUEST_TIMEOUT_IN_MS,
        validateStatus: () => true,
      });

      if (response.status === 200) {
        this.#cache.set(cacheKey, {body: response.data, fetchedAt: Date.now()});
        return {status: 200, body: response.data, source: 'upstream'};
      }

      if (response.status < 500) {
        // A definite answer such as 404 (unknown template) or 401/403 (bad key)
        // is passed through, never hidden behind a stub.
        logger.error(`SendGrid answered ${response.status} for ${what}.`);
        return {status: response.status, body: response.data, source: 'upstream'};
      }

      logger.warn(`SendGrid answered ${response.status} for ${what}.`);
    } catch (error) {
      logger.warn(`Failed to fetch ${what} from SendGrid: ${error.message}`);
    }

    if (cached) {
      return {status: 200, body: cached.body, source: 'stale'};
    }

    return {status: 200, body: stub(), source: 'stub'};
  }
}

module.exports = TemplateHandler;
