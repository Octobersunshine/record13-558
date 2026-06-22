FROM node:18-alpine

ARG VERSION=1.0.0
ARG ENV=production

LABEL version="1.0.0"
LABEL maintainer="build-service"
LABEL base.image="node:18-alpine"

WORKDIR /app

COPY . .

RUN echo "Build completed at $(date)"
