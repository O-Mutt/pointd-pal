import { Md } from 'slack-block-builder';

import { App } from '@slack/bolt';
import { LogLevel } from '@slack/logger';

import { PointdPalInstallStore } from './src/lib/services/pointdPalInstallStore';

import { config } from '@config';
require('newrelic');

import { healthEndpoint } from './src/lib/routes/health';

export let app = new App({
	signingSecret: config.get('slack.signingSecret'),
	clientId: config.get('slack.signingSecret'),
	clientSecret: config.get('slack.clientSecret'),
	stateSecret: config.get('slack.stateSecret'),
	logLevel: config.get('logLevel') as LogLevel,
	installationStore: PointdPalInstallStore,
	tokenVerificationEnabled: true,
	installerOptions: {
		directInstall: true,
	},
	scopes: [
		'app_mentions:read',
		'channels:history',
		'channels:manage',
		'channels:read',
		'channels:join',
		'chat:write',
		'commands',
		'groups:history',
		'groups:read',
		'groups:write',
		'im:history',
		'im:read',
		'im:write',
		'mpim:history',
		'mpim:read',
		'mpim:write',
		'users.profile:read',
		'users:read',
		'users:read.email',
		'usergroups:read',
	],
	customRoutes: [healthEndpoint],
});

// messages
import './src/messages.crypto';
import './src/messages.scoreboard';
import './src/messages.help';
import './src/messages.plusplus';

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

app.action('button_click', async ({ body, ack, respond }) => {
	// Acknowledge the action
	await ack();
	await respond(`${Md.user(body.user.id)} clicked the button`);
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
