# To Deploy on Bringme Azure Portal
Run the following commands:
- Build and tag the image as follows: `docker build -t bringme.azurecr.io/sendgrid-mock:0.2 .`
- Login into Azure using `az login`
- Use the correct Container Registry with the following command: `az acr login --name bringme`
- Push the image as follows: `docker push bringme.azurecr.io/sendgrid-mock:0.2`
