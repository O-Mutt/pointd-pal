import convict from 'convict';
import { PointdPalConfig } from './config.schema';

export const config = convict<PointdPalConfig>({
	spamMessage: {
		doc: 'Message to send when a user is spamming.',
		format: String,
		default: 'Looks like you hit the spam filter. Please slow your roll.',
		env: 'SPAM_MESSAGE',
	},
	spamTimeLimit: {
		doc: 'Time limit for spamming.',
		format: Number,
		default: 5,
		env: 'SPAM_TIME_LIMIT',
	},
	mongoUri: {
		doc: 'MongoDB URI.',
		format: String,
		sensitive: true,
		default: 'mongodb://localhost/plusPlus',
		env: 'MONGO_URI',
	},
	cryptoRpcProvider: {
		doc: 'Crypto RPC provider.',
		format: String,
		default: null,
		env: 'CRYPTO_RPC_PROVIDER',
	},
	magicNumber: {
		doc: 'Magic number.',
		format: String,
		sensitive: true,
		default: null,
		env: 'MAGIC_NUMBER',
	},
	magicIv: {
		doc: 'Magic IV.',
		format: String,
		sensitive: true,
		default: null,
		env: 'MAGIC_IV',
	},
	furtherHelpUrl: {
		doc: 'Further help URL.',
		format: String,
		default: null,
		env: 'FURTHER_HELP_URL',
	},
	monthlyScoreboardCron: {
		doc: 'Monthly scoreboard cron.',
		format: String,
		default: '0 10 1-7 * *',
		env: 'MONTHLY_SCOREBOARD_CRON',
	},
	monthlyScoreboardDayOfWeek: {
		doc: 'Monthly scoreboard day of week.',
		format: Number,
		default: 1,
		env: 'MONTHLY_SCOREBOARD_DAY_OF_WEEK',
	},
	defaultDb: {
		doc: 'Default DB name.',
		format: String,
		default: null,
		env: 'DEFAULT_DB_NAME',
	},
	slack: {
		signingSecret: {
			doc: 'Slack signing secret.',
			format: String,
			sensitive: true,
			default: null,
			env: 'SLACK_SIGNING_SECRET',
		},
		clientId: {
			doc: 'Slack client ID.',
			format: String,
			default: null,
			env: 'SLACK_CLIENT_ID',
		},
		clientSecret: {
			doc: 'Slack client secret.',
			format: String,
			sensitive: true,
			default: null,
			env: 'SLACK_CLIENT_SECRET',
		},
		stateSecret: {
			doc: 'Slack state secret.',
			format: String,
			sensitive: true,
			default: null,
			env: 'SLACK_STATE_SECRET',
		},
	},
	logLevel: {
		doc: 'Log level.',
		format: String,
		default: 'info',
		env: 'LOG_LEVEL',
	},
});
