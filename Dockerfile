FROM node:10.15
LABEL author="Siyavash Habashi (janjaali)"

WORKDIR /sendgrid-mock

ADD src src/
ADD package*.json ./
RUN npm install

CMD ["npm", "run", "server-dev"]
