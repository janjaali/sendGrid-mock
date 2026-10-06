# SendGrid-Mock

SendGrid-Mock serves as a simple server mocking the sendgrid-apis for development purposes.

![./assets/screenshot_1.8.0.png](./assets/screenshot_1.8.0.png)

## Functionalities

### HTTP API

* Send mails `POST /v3/mail/send`

* Retrieve sent mails `GET /api/mails`
  * Filter capabilities are included and can be combined:
    * **To**: `GET /api/mails?to=email@address.com`
    * **Subject**:
      * `GET /api/mails?subject=The subject` (*exact match*)
      * `GET /api/mails?subject=%subject%` (*contains*)
    * **Datetime**: `GET /api/mails?dateTimeSince=2020-12-06T10:00:00Z` (
      *[ISO-8601 format](https://en.wikipedia.org/wiki/ISO_8601)*)

* Delete sent mails `DELETE /api/mails`
  * Filter capabilities are included and can be combined:
    * **To**: `DELETE /api/mails?to=email@address.com`

* Get template information `GET /v3/templates/:id` (requires the same `Authorization: Bearer <API_KEY>` header as sending). Senders that look up a template's active version, such as its subject, before sending can use this. See [Templates](#templates).

### UI

* Retrieve sent mails and display them
* Delete sent mails

### Extras

* Basic authentication support: Add basic authentication credentials by specifying environment variable `AUTHENTICATION` to the following format: `user1:passwordForUser1;user2:passwordForUser2`. This applies only to the static content.

* API key support: Add API key authentication by specifying environment variable `API_KEY`. This applies only to the API endpoints.

* Request rate limiting: Both the actual SendGrid API server as well as the SSL server can be rate limited by specifying environment variables:
  * `RATE_LIMIT_ENABLED`: `true` or `false` (default)
  * `RATE_LIMIT_WINDOW_IN_MS`: The time window in milliseconds (default: `60000`)
  * `RATE_LIMIT_MAX_REQUESTS`: The maximum number of requests allowed in the time window (default: `100`)
  * `SSL_RATE_LIMIT_ENABLED`: `true` or `false` (default)
  * `SSL_RATE_LIMIT_WINDOW_IN_MS`: The time window in milliseconds (default: `60000`)
  * `SSL_RATE_LIMIT_MAX_REQUESTS`: The maximum number of requests allowed in the time window (default: `100`)

* By default, all emails older than 24 hours will be deleted. This can be configured using environment variable `MAIL_HISTORY_DURATION` which uses [ISO-8601 Duration format](https://en.wikipedia.org/wiki/ISO_8601#Durations) such as *'PT24H'*.

* <a id="templates"></a>Templates: by default `GET /v3/templates/:id` returns a generic stub with one active version. To return the real templates, set `SENDGRID_TEMPLATE_API_KEY` to a SendGrid API key that is only allowed to read templates (*Template Engine: Read*; it does not need, and should not have, *Mail Send*). Templates are then fetched from SendGrid and returned unchanged:
  * `SENDGRID_TEMPLATE_BASE_URL`: SendGrid API base URL (default: `https://api.sendgrid.com/v3`)
  * `TEMPLATE_CACHE_TTL`: how long a fetched template is cached, in [ISO-8601 Duration format](https://en.wikipedia.org/wiki/ISO_8601#Durations) (default: `PT1H`)
  * If SendGrid cannot be reached (network error or 5xx) the last cached template is returned even if expired, otherwise the stub. Definite answers such as `404` or `401` are passed through. The `X-Mock-Template-Source` response header tells where the answer came from: `upstream`, `cache`, `stale` or `stub`.

* Event support: Add basic [event](https://www.twilio.com/docs/sendgrid/for-developers/tracking-events/event#events) support by specifying the environment variable `EVENT_DELIVERY_URL`. When set, [delivered](https://www.twilio.com/docs/sendgrid/for-developers/tracking-events/event#delivered) events will be sent to the specified webhook URL when an email is sent.

## Dockerized

The SendGrid-Mock server and the UI are both contained in the same docker-image which you can pull from [Docker Hub](https://cloud.docker.com/u/ghashange/repository/docker/ghashange/sendgrid-mock) and start it via:

```shell
docker run -it -p 3000:3000 -e "API_KEY=sendgrid-api-key" ghashange/sendgrid-mock:1.13.0
```

Some prepared HTTP calls can be found [here](./http-calls).

The UI can be accessed at <http://localhost:3000>.

### SSL support

SendGrid-Mock also supports SSL using [Let's Encrypt](https://letsencrypt.org/). To enable SSL, run it as follows:

```shell
docker run -it -p 3000:3000 -e "API_KEY=sendgrid-api-key" -e "CERT_DOMAINNAMES=[your-domain-name]" -e "CERT_EMAIL=[your-email-address]" ghashange/sendgrid-mock:1.13.0
```

## Development

Setup with `npm ci` and start both server and UI concurrently with `npm run dev`. Per default the server is reachable via <http://localhost:3000> and the UI via <http://localhost:1234>.

Some prepared HTTP calls can be found [here](./http-calls).

The UI can be accessed at <http://localhost:3000>.

### Build

Create docker image with `docker build -t ghashange/sendgrid-mock:1.13.0 .`.

### Release

1. Update version number in [package.json](./package.json), [version file](./version) and [README](./README.md)

2. Create PR against **master** branch

3. Merge PR

4. Create GitHub release and update [Docker Hub description](https://hub.docker.com/repository/docker/ghashange/sendgrid-mock)
