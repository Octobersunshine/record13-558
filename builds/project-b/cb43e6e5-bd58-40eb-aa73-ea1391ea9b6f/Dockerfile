FROM node:20-slim

ARG APP_NAME=app-beta
ARG VERSION=2.0.0
ARG ENV=staging
ARG TEAM=team-beta

LABEL version="2.0.0"
LABEL maintainer="build-service"
LABEL base.image="node:20-slim"

WORKDIR /app

COPY . .

RUN echo "Build completed at $(date)"
