FROM node:10.15-slim
LABEL author="Siyavash Habashi (ghashange)"

ENV API_KEY=sendgrid-api-key

WORKDIR /sendgrid-mock

ADD src src/
ADD package*.json ./
RUN npm install
RUN npm run build

CMD ["npm", "run", "server-dev"]
