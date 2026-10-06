const axios = require('axios');

const {loggerFactory} = require('../logger/log4js');
const {parseDurationStringAsSeconds} = require('../util/duration');

const logger = loggerFactory('TemplateHandler');

const DEFAULT_BASE_URL = 'https://api.sendgrid.com/v3';
const DEFAULT_CACHE_TTL = 'PT1H';
const REQUEST_TIMEOUT_IN_MS = 5000;

// SendGrid template ids look like 'd-<hex>' (dynamic) or a uuid (legacy).
const VALID_TEMPLATE_ID = /^[\w-]+$/;

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
 * Serves SendGrid template information (`GET /v3/templates/:id`).
 *
 * If a read-only SendGrid API key is configured the template is fetched from
 * SendGrid and cached. Without a key, or if SendGrid cannot be reached and
 * nothing is cached, a generic stub is returned so that senders depending on
 * the template lookup keep working.
 */
class TemplateHandler {

  #apiKey;

  #baseUrl;

  #cacheTtlInMs;

  #httpClient;

  #cache = new Map();

  #inFlight = new Map();

  constructor({apiKey, baseUrl, cacheTtl, httpClient = axios} = {}) {

    this.#apiKey = apiKey;
    this.#baseUrl = (baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.#cacheTtlInMs = parseDurationStringAsSeconds(cacheTtl || DEFAULT_CACHE_TTL) * 1000;
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

    const cached = this.#cache.get(templateId);
    if (cached && Date.now() - cached.fetchedAt < this.#cacheTtlInMs) {
      return {status: 200, body: cached.body, source: 'cache'};
    }

    if (!this.#apiKey) {
      return {status: 200, body: stubTemplate(templateId), source: 'stub'};
    }

    // Share one upstream request between concurrent requests for the same template.
    if (!this.#inFlight.has(templateId)) {
      const request = this.#fetchFromUpstream(templateId, cached)
        .finally(() => this.#inFlight.delete(templateId));
      this.#inFlight.set(templateId, request);
    }

    return this.#inFlight.get(templateId);
  }

  async #fetchFromUpstream(templateId, cached) {

    try {
      const response = await this.#httpClient.get(
        `${this.#baseUrl}/templates/${encodeURIComponent(templateId)}`,
        {
          headers: {Authorization: `Bearer ${this.#apiKey}`},
          timeout: REQUEST_TIMEOUT_IN_MS,
          validateStatus: () => true,
        }
      );

      if (response.status === 200) {
        this.#cache.set(templateId, {body: response.data, fetchedAt: Date.now()});
        return {status: 200, body: response.data, source: 'upstream'};
      }

      if (response.status < 500) {
        // A definite answer such as 404 (unknown template) or 401/403 (bad key)
        // is passed through, never hidden behind a stub.
        logger.error(`SendGrid answered ${response.status} for template ${templateId}.`);
        return {status: response.status, body: response.data, source: 'upstream'};
      }

      logger.warn(`SendGrid answered ${response.status} for template ${templateId}.`);
    } catch (error) {
      logger.warn(`Failed to fetch template ${templateId} from SendGrid: ${error.message}`);
    }

    if (cached) {
      return {status: 200, body: cached.body, source: 'stale'};
    }

    return {status: 200, body: stubTemplate(templateId), source: 'stub'};
  }
}

module.exports = TemplateHandler;
