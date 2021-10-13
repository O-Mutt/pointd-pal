import { App } from '@slack/bolt';
import { LogLevel } from '@slack/logger';

import { regExpCreator } from './src/lib/regexpCreator';

require('dotenv').config();

// Initializes your app with your bot token and app token
export const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
  logLevel: process.env.LOG_LEVEL as LogLevel
});


import './src/eventHandlers';
import './src/migrations';
import './src/plusplus';
import './src/wallet';
import './src/scoreboard';
import './src/eventHandlers';

app.action('button_click', async ({ body, ack, say }) => {
  // Acknowledge the action
  await ack();
  await say(`<@${body.user.id}> clicked the button`);
});

app.message('hello world', async ({say}) => {
  await say('hey, friend.');
});

app.message(/.*/, async ({ message, context, logger }) => {
  logger.debug("This is for logging all the things!", message, context, regExpCreator.createAskForScoreRegExp());
  //await say(context.matches.input);
});

(async () => {
  // Start your app
  let port = 5000;
  if (process.env.PORT) {
    port = parseInt(process.env.PORT, 10);
  }
  await app.start(port);

  console.log(`⚡️ Bolt app is running at localhost:${port}!`);
})();