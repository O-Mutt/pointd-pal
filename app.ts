import { App } from '@slack/bolt';
import { LogLevel } from '@slack/logger';
import { QraftyInstallStore } from './src/lib/services/qraftyInstallStore';

require('dotenv').config();

export let app;
if (process.env.NODE === 'production') {
  // Initializes your app with your bot token and app token
  app = new App({
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    clientId: process.env.SLACK_CLIENT_ID,
    clientSecret: process.env.SLACK_CLIENT_SECRET,
    stateSecret: process.env.SLACK_STATE_SECRET,
    logLevel: process.env.LOG_LEVEL as LogLevel,
    installationStore: QraftyInstallStore,
  });
} else {
  app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    socketMode: true,
    appToken: process.env.SLACK_APP_TOKEN,
    logLevel: process.env.LOG_LEVEL as LogLevel,
  });
}

import './src/actions.bonusly';
import './src/messages.plusplus';
import './src/migrations';
import './src/messages.qrypto';
import './src/messages.scoreboard';
import './src/events';
import './src/events.bonusly';
import './src/monthlyScoreboardCron';
import './src/hometab';
import './src/hometab.actions';
import './src/hometab.views';
import { Md } from 'slack-block-builder';

app.action('button_click', async ({ body, ack, say }) => {
  // Acknowledge the action
  await ack();
  await say(`${Md.user(body.user.id)} clicked the button`);
});

app.message(/.*/, async ({ message, context, logger }) => {
  logger.debug('This is for logging all the things!', message, context);
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
