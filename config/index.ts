import convict from 'convict';
import { PointdPalConfig } from './config.schema';

const config = convict<PointdPalConfig>({
	env: {
		doc: 'The application environment.',
		format: ['production', 'development', 'test'],
		default: 'development',
		env: 'NODE_ENV',
	},
	logLevel: {
		doc: 'Log level.',
		format: String,
		default: 'info',
		env: 'LOG_LEVEL',
	},
	spam: {
		responseMessage: {
			doc: 'Message to send when a user is spamming.',
			format: String,
			default: 'Looks like you hit the spam filter. Please slow your roll.',
			env: 'SPAM_MESSAGE',
		},
		timeout: {
			doc: 'Time limit for spamming.',
			format: Number,
			default: 5,
			env: 'SPAM_TIME_LIMIT',
		},
	},
	postgres: {
		default: null,
		host: {
			doc: 'Postgres host.',
			format: String,
			default: 'localhost',
			env: 'POSTGRES_HOST',
		},
		port: {
			doc: 'Postgres port.',
			format: 'port',
			default: 5432,
			env: 'POSTGRES_PORT',
		},
		username: {
			doc: 'Postgres user.',
			format: String,
			default: 'postgres',
			env: 'POSTGRES_USERNAME',
		},
		password: {
			doc: 'Postgres password.',
			format: String,
			sensitive: true,
			default: 'password',
			env: 'POSTGRES_PASSWORD',
		},
		database: {
			doc: 'Postgres root database.',
			format: String,
			default: 'pointdpal',
			env: 'POSTGRES_DB',
		},
	},
	crypto: {
		default: {
			cryptoRpcProvider: null,
			magicNumber: null,
			magicIv: null,
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
	},
	furtherHelpUrl: {
		doc: 'Further help URL.',
		format: String,
		default: 'For more information on pointdpal please visit our help page: https://pointdpal.com/help',
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
});

// Load environment dependent configuration
var env = config.get('env');
config.loadFile('./config/' + env + '.json');

// Perform validation
config.validate({ allowed: 'strict' });

export { config };
export default config;
