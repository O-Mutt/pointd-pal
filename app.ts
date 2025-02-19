import { App } from '@slack/bolt';
import { LogLevel } from '@slack/logger';

import { config } from '@/config';
import { healthEndpoint } from '@/lib/routes/health';
import { withNamespace } from '@/logger';

import '@/lib/stringExtensions';
import '@/lib/dateExtensions';
import '@/lib/numberExtensions';

// messages
import { registerCrypto, registerHelp, registerPlusPlus, registerScoreboard } from '@/messages';

// etc
import { register as migrationsRegister } from '@/migrations';

// workers
import { scoreboardWorker } from '@/workers/scoreboard';

// event handlers
import './src/events';

// hometab
import { register as hometabRegister } from '@/hometabs/hometab';
import { register as hometabActionsRegister } from '@/hometabs/hometab.actions';
import { register as adminHometabActionsRegister } from '@/hometabs/hometab.actions.admin';
import { register as hometabViewsRegister } from '@/hometabs/hometab.views';
import { register as adminHometabViewsRegister } from '@/hometabs/hometab.views.admin';

// slash commands
import { register as slashPlusPlusRegister } from '@/commands';

//shortcuts
import { register as shortcutsRegister } from '@/shortcuts';
import { installService } from '@/lib/services';
import { pointdPalInstallationStore } from '@/lib/installationStore';

const appLogger = withNamespace('pointd-pal');
const app = new App({
	signingSecret: config.get('slack.signingSecret'),
	clientId: config.get('slack.clientId'),
	clientSecret: config.get('slack.clientSecret'),
	stateSecret: config.get('slack.stateSecret'),
	appToken: config.get('slack.appToken'),
	logLevel: config.get('logLevel') as LogLevel,
	socketMode: true,
	installationStore: pointdPalInstallationStore,
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
		debug: (...msg) => appLogger.debug(msg),
		info: (...msg) => appLogger.info(msg),
		warn: (...msg) => appLogger.warn(msg),
		error: (...msg) => appLogger.error(msg),
		setName: (name: string) => appLogger.label(name),
	},
});

void (async () => {
	appLogger.info(
		'Before we start the apps we will validate that all installations are up to date by running migrations. Please hold on...',
	);
	await installService.migrateAll();

	await scoreboardWorker.startAllWorkers();
	// Start your app
	await app.start({ port: config.get('port') });

	appLogger.info(`⚡️ Bolt app is running at localhost:${config.get('port')}!`);
})();

registerCrypto(app);
registerScoreboard(app);
registerHelp(app);
registerPlusPlus(app);
migrationsRegister(app);
shortcutsRegister(app);
hometabRegister(app);
hometabActionsRegister(app);
adminHometabActionsRegister(app);
hometabViewsRegister(app);
adminHometabViewsRegister(app);
slashPlusPlusRegister(app);

export { app };
