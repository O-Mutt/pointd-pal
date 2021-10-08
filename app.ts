import { App } from '@slack/bolt';

require('dotenv').config();

// Initializes your app with your bot token and app token
export const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN
});


import './src/eventHandlers';
import './src/migrations';
import './src/plusplus';


app.action('button_click', async ({ body, ack, say }) => {
  // Acknowledge the action
  await ack();
  await say(`<@${body.user.id}> clicked the button`);
});

app.message('hello world', async ({say}) => {
  await say('hey, friend.');
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