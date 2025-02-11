FROM node:lts-bullseye-slim as build-stage

ARG PORT="3000"
ARG NODE_ENV="production"

WORKDIR /app
COPY package*.json .
COPY . .

RUN npm ci

EXPOSE $PORT
ENV NODE_ENV=${NODE_ENV}
ENV PORT=${PORT}

CMD ["npm", "run", "start"]