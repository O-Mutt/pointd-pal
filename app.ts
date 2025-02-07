import { PointdPalInstallStore } from '@/lib/services/installStore';
import { Md } from 'slack-block-builder';

import { App } from '@slack/bolt';
import { LogLevel } from '@slack/logger';

import { config } from '@/config';
import { healthEndpoint } from '@/lib/routes/health';
import { logger as customLogger } from '@/logger';

import '@/lib/stringExtensions';
import '@/lib/dateExtensions';
import '@/lib/numberExtensions';

// messages
import { register as messagesCryptoRegister } from '@/messages.crypto';
import { register as messagesScoreboardRegister } from '@/messages.scoreboard';
import { register as messagesHelpRegister } from '@/messages.help';
import { register as messagesPlusPlusRegister } from '@/messages.plusplus';

// etc
import { register as migrationsRegister } from '@/migrations';

// cron job
import './src/monthlyScoreboardCron';

// event handlers
import './src/events';

// hometab
import { register as hometabRegister } from '@/hometab';
import { register as hometabActionsRegister } from '@/hometab.actions';
import { register as hometabViewsRegister } from '@/hometab.views';

//shortcuts
import { register as shortcutsRegister } from '@/shortcuts';
import * as installService from '@/lib/services/installService';

const app = new App({
	signingSecret: config.get('slack.signingSecret'),
	clientId: config.get('slack.clientId'),
	clientSecret: config.get('slack.clientSecret'),
	stateSecret: config.get('slack.stateSecret'),
	appToken: config.get('slack.appToken'),
	logLevel: config.get('logLevel') as LogLevel,
	socketMode: true,
	installationStore: PointdPalInstallStore,
	tokenVerificationEnabled: true,
	redirectUri: `${config.get('baseUrl')}/slack/oauth_redirect`,
	installerOptions: {
		directInstall: true,
		// stateVerification: false,
		redirectUriPath: '/slack/oauth_redirect',
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

void (async () => {
	customLogger.info(
		'Before we start the apps we will validate that all installations are up to date by running migrations. Please hold on...',
	);
	await installService.migrateAll();
	// Start your app
	await app.start({ port: config.get('port') });

	customLogger.info(`⚡️ Bolt app is running at localhost:${config.get('port')}!`);
})();

messagesCryptoRegister(app);
messagesScoreboardRegister(app);
messagesHelpRegister(app);
messagesPlusPlusRegister(app);
migrationsRegister(app);
shortcutsRegister(app);
hometabRegister(app);
hometabActionsRegister(app);
hometabViewsRegister(app);

export { app };
