# SendGrid-Mock

![Node.js CI](https://github.com/janjaali/sendGrid-mock/workflows/Node.js%20CI/badge.svg)

SendGrid-Mock serves as a simple server mocking the sendgrid-apis for development purposes.

![./assets/screenshot_1.8.0.png](./assets/screenshot_1.8.0.png)

SendGrid-Mock provides the following functionalities:

* Send mails to a mocked sendgrid-api (v3: `POST /v3/mail/send`)
  * Authentication included

* Retrieve sent mails via an API (`GET /api/mails`). You can also filter these mails as follows:
  * `GET /api/mails?to=email@address.com`
  * `GET /api/mails?subject=The subject` (subject must match exactly)
  * `GET /api/mails?subject=%subject%` (subject contains text)
  * `GET /api/mails?dateTimeSince=2020-12-06T10:00:00` (only emails after specified dateTimeSince ([ISO-8601 format](https://en.wikipedia.org/wiki/ISO_8601) such as `YYYY-MM-DDThh:mm:ssZ`))
  * All the above can be combined

* Clear sent mails via an API (`DELETE /api/mails`)
  * You can also delete all mails sent to a certain email address: `DELETE /api/mails?to=email@address.com`

* Retrieve sent mails via a simple UI
  * You can add basic authentication to it by specifying an environment variable `AUTHENTICATION` which has the following format: `user1:passwordForUser1;user2:passwordForUser2`

* By default, all emails older than 24 hours will be deleted. This can be configured using environment variable `MAIL_HISTORY_DURATION` which uses [ISO-8601 Duration format](https://en.wikipedia.org/wiki/ISO_8601#Durations) such as 'PT24H'.

## Dockerized

The SendGrid-Mock server and the UI are both contained in the same docker-image which you can pull from [docker-hub](https://cloud.docker.com/u/ghashange/repository/docker/ghashange/sendgrid-mock) and start it via:

```shell
docker run -it -p 3000:3000 -e "API_KEY=sendgrid-api-key" ghashange/sendgrid-mock:1.8.0
```

Sendgrid mock also supports SSL using [Let's Encrypt](https://letsencrypt.org/). To enable SSL, run it as follows:

```shell
docker run -it -p 3000:3000 -e "API_KEY=sendgrid-api-key" -e "CERT_DOMAINNAMES=[your-domain-name]" -e "CERT_EMAIL=[your-email-address]" ghashange/sendgrid-mock:1.8.0
```

Example calls are attached in [https-calls](./http-calls).

The UI can be accessed at <http://localhost:3000>.

## Development

Just install dependencies `npm ci` and start both server and UI concurrently with `npm run dev`. Per default the server is reachable via <http://localhost:3000> and the UI via <http://localhost:1234>.

You can find some prepared http-calls in [./http-calls](./http-calls) to get started.

## Build

Create docker image with `docker build -t ghashange/sendgrid-mock:1.8.0 .`.

## Release

1. Update version number in [package.json](./package.json),  [README.md](./README.md) and [VERSION](./version)

2. Create PR against master branch

3. Merge PR once feature set is complete

4. Create GitHub release and update [dockerhub description](https://hub.docker.com/repository/docker/ghashange/sendgrid-mock)
