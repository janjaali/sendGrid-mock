# SendGrid-Mock

SendGrid-Mock serves as a simple server mocking the sendgrid-apis for development purposes.

SendGrid-Mock provides the following functionalities:

* Send mails to a mocked sendgrid-api (v3: `POST /v3/mail/send`)
  * Authentication included

* Retrieve sent mails via an API (`GET /api/mails`)

* Clear sent mails via an API (`DELETE /api/mails`)

* Retrieve sent mails via a simple UI

## Dockerized

The SendGrid-Mock server and the UI are both contained in the same docker-image which you can pull from [docker-hub](https://cloud.docker.com/u/ghashange/repository/docker/ghashange/sendgrid-mock) and start it via:

```shell
docker run -it -p 3000:3000 -e "API_KEY=sendgrid-api-key" ghashange/sendgrid-mock:1.0.3
```

Example calls are attached in [https-calls](./http-calls).

The UI can be accessed at <http://localhost:3000>.

## Development

Just install dependencies `npm install`, start both server and UI via `npm run dev` and start hacking. You may find useful http-calls in [./http-calls](./http-calls).

The server is based on [node]/[express]. [React] is used for the UI.

[express]: http://expressjs.com/
[node]: https://nodejs.org/
[React]: https://reactjs.org/

## Build

To build a publish-able docker image you may use:

```shell
 docker build -t ghashange/sendgrid-mock:1.1.1 .
```

## Release

Builds can be pushed to [dockerhub](https://hub.docker.com/) via:

```shell
docker push ghashange/sendgrid-mock:1.1.1
```
