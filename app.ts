import { Md } from 'slack-block-builder';

import { App } from '@slack/bolt';
import { LogLevel } from '@slack/logger';

import { QraftyInstallStore } from './src/lib/services/qraftyInstallStore';

require('dotenv').config();

export let app = new App({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  clientId: process.env.SLACK_CLIENT_ID,
  clientSecret: process.env.SLACK_CLIENT_SECRET,
  stateSecret: process.env.SLACK_STATE_SECRET,
  logLevel: process.env.LOG_LEVEL as LogLevel,
  installationStore: QraftyInstallStore,
  tokenVerificationEnabled: true,
  installerOptions: {
  },
  scopes: [
    "app_mentions:read",
    "channels:history",
    "channels:manage",
    "channels:read",
    "channels:join",
    "chat:write",
    "commands",
    "groups:history",
    "groups:read",
    "groups:write",
    "im:history",
    "im:read",
    "im:write",
    "mpim:history",
    "mpim:read",
    "mpim:write",
    "users.profile:read",
    "users:read",
    "users:read.email",
    "usergroups:read",
  ]
});

// messages
import './src/messages.qrypto';
import './src/messages.scoreboard';
import './src/messages.help';
import './src/messages.plusplus';

// bonusly
import './src/actions.bonusly';
import './src/events.bonusly';

// etc
import './src/events';
import './src/migrations';
import './src/monthlyScoreboardCron';

// hometab
import './src/hometab';
import './src/hometab.actions';
import './src/hometab.views';

//shortcuts
import './src/shortcuts';

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
