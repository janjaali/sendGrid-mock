FROM node:10.15-slim
LABEL author="Siyavash Habashi (ghashange) / Ronald Dehuysser (Bringme)"

ENV API_KEY=sendgrid-api-key

WORKDIR /sendgrid-mock

ADD src src/
ADD package*.json ./
RUN npm ci
RUN npm run build

CMD ["npm", "run", "server-run"]
