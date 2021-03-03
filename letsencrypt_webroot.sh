#!/usr/bin/env sh

# If the following environment variables are set, certbot will try to generate a new SSL certificate for your domain.
# A certificate renewal chronjob will also be created.
if [ $CERT_DOMAINNAMES ] && [ $CERT_EMAIL ]; then

    # Wait for DNS to be mapped to IP and docker container to be fully started
    sleep 60
    # Generate the initial letsencrypt / certbot SSL certificate using the webroot method.
    # This method will send a challenge to this server's http port 80.
    # If the response is valid, certbot will put the generated SSL certificates in the following directory: /etc/letsencrypt/live/$SUBDOMAIN.$DOMAIN/
    echo "Executing the initial letsencrypt / certbot SSL certificate request ..."
    certbot certonly --webroot --webroot-path /usr/src/server --keep -d $CERT_DOMAINNAMES -n --agree-tos --no-self-upgrade -m $CERT_EMAIL

else
    echo "(optional) To generate a letsencrypt / certbot SSL certificate, make sure the following environment variables are set: CERT_DOMAINNAMES, CERT_EMAIL"
fi
