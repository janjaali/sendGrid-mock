FROM node:alpine
LABEL author="Siyavash Habashi (ghashange) / Ronald Dehuysser (Bringme)"

# adds the packages certbot and tini, make and g++ (make and g++ needed for nmp ci)
RUN apk add --no-cache certbot tini make g++
ENTRYPOINT ["/sbin/tini", "--"]

# copy and chmod the shell script which will initiate the webroot
COPY letsencrypt_webroot.sh /
RUN chmod +x /letsencrypt_webroot.sh

# port 80 is mandatory for webroot challenge
# port 443 is mandatory for https
EXPOSE 80
EXPOSE 443
EXPOSE 3000

ENV DOCKER_BUILD="true"
ENV API_KEY=sendgrid-api-key

# the directory for your app within the docker image
# NOTE: if you need to change this, change the $CERT_WEBROOT_PATH env
WORKDIR /usr/src/server

######################################################################################
# Add your own Dockerfile entries here
######################################################################################
ADD src src/
ADD package*.json ./
RUN npm ci
RUN npm run build


# the command which starts your express server. Rename 'index.js' to the appropriate filename
ENV DOCKER_BUILD="false"
CMD ["npm", "run", "server-run"]