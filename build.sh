#!/bin/bash
export DOCKER_BUILDKIT=1
sha=$(git rev-parse --short HEAD)
echo $sha
docker build -t asia.gcr.io/persuit-core/sendgrid-mock:$sha .
docker push asia.gcr.io/persuit-core/sendgrid-mock:$sha
