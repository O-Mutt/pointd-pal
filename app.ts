import { Md } from 'slack-block-builder';

import { App } from '@slack/bolt';
import { LogLevel } from '@slack/logger';

import { config } from './src/config';
import 'newrelic';

import { healthEndpoint } from './src/lib/routes/health';
import { logger as customLogger } from './src/logger';

export const app = new App({
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
	logger: {
		getLevel: () => config.get('logLevel') as LogLevel,
		setLevel: (level: LogLevel) => config.set('logLevel', level),
		debug: (...msg) => customLogger.debug(msg),
		info: (...msg) => customLogger.info(msg),
		warn: (...msg) => customLogger.warn(msg),
		error: (...msg) => customLogger.error(msg),
		setName: (name: string) => customLogger.label(name),
	},
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
import logger from '@/logger';

app.action('button_click', async ({ body, ack, respond }) => {
	// Acknowledge the action
	await ack();
	await respond(`${Md.user(body.user.id)} clicked the button`);
});

app.message(/.*/, async ({ message, context, logger, say }) => {
	logger.debug('This is for logging all the things!', message, context);
	if (config.get('env') === 'development') {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
		await say(context.matches.input);
	}
});

await (async () => {
	// Start your app
	await app.start(config.get('port'));

	logger.info(`⚡️ Bolt app is running at localhost:${config.get('port')}!`);
})();

import { PointdPalInstallStore } from './src/lib/services/installStore';
