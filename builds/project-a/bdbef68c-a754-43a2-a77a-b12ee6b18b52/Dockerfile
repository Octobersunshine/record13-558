FROM node:18-alpine

ARG APP_NAME=app-alpha
ARG VERSION=1.0.0
ARG ENV=production
ARG TEAM=team-alpha

LABEL version="1.0.0"
LABEL maintainer="build-service"
LABEL base.image="node:18-alpine"

WORKDIR /app

COPY . .

RUN echo "Build completed at $(date)"
