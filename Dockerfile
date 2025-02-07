FROM node:latest

ARG HOME=/home/node/app
ARG PORT="3000"
ARG NODE_ENV="development"

RUN mkdir -p $HOME/node_modules
WORKDIR $HOME

COPY package*.json $HOME
COPY . $HOME


RUN npm install

EXPOSE $PORT
ENV NODE_ENV=${NODE_ENV}
ENV PORT=${PORT}

CMD ["npm", "run" "ngrok", "&&", "npm", "run", "start"]