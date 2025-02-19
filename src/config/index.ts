import convict from 'convict';
import { PointdPalConfig } from './config.schema';

const config = convict<PointdPalConfig>({
	baseUrl: {
		doc: 'The base URL of the application.',
		format: String,
		default: 'https://pointdpal.okeefe.dev',
		env: 'BASE_URL',
	},
	port: {
		doc: 'The port to bind.',
		format: 'port',
		default: 3000,
		env: 'PORT',
	},
	env: {
		doc: 'The application environment.',
		format: ['development', 'test', 'production'],
		default: 'development',
		env: 'NODE_ENV',
	},
	logLevel: {
		doc: 'Log level.',
		format: String,
		default: 'info',
		env: 'LOG_LEVEL',
	},
	notificationsChannel: {
		doc: 'The name of the room to post notifications.',
		format: String,
		default: 'pointd-notifications',
		env: 'NOTIFICATIONS_CHANNEL',
	},
	formalFeedbackModulo: {
		doc: 'Modulo for formal feedback.',
		format: Number,
		default: 5,
		env: 'FORMAL_FEEDBACK_MODULO',
	},
	scoreKeywords: {
		doc: 'Keywords to trigger score changes.',
		format: Array,
		default: ['score', 'scores', 'karma'],
		env: 'SCORE_KEYWORDS',
	},
	reasonConjunctions: {
		doc: 'Conjunctions for reasons.',
		format: Array,
		default: ['for', 'because', 'cause', 'cuz', 'as', 'porque', 'just', 'thanks for', 'since'],
		env: 'REASON_CONJUNCTIONS',
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
			default: 'pointdpal',
			env: 'POSTGRES_USERNAME',
		},
		password: {
			doc: 'Postgres password.',
			format: String,
			sensitive: true,
			default: 'pointdpal',
			env: 'POSTGRES_PASSWORD',
		},
		database: {
			doc: 'Postgres root database.',
			format: String,
			default: 'pointdpal',
			env: 'POSTGRES_DB',
		},
		schema: {
			doc: 'Postgres schema.',
			format: String,
			default: 'pointdpal',
			env: 'POSTGRES_SCHEMA',
		},
	},
	crypto: {
		rpcProvider: {
			doc: 'Crypto RPC provider.',
			format: String,
			nullable: true,
			default: null,
			env: 'CRYPTO_RPC_PROVIDER',
		},
		magicNumber: {
			doc: 'Magic number.',
			format: String,
			sensitive: true,
			nullable: true,
			default: null,
			env: 'CRYPTO_MAGIC_NUMBER',
		},
		magicIv: {
			doc: 'Magic IV.',
			format: String,
			sensitive: true,
			nullable: true,
			default: null,
			env: 'CRYPTO_MAGIC_IV',
		},
		helpUrl: {
			doc: 'Further help message.',
			format: String,
			default: 'https://pointdpal.com/crypto/help',
			env: 'CRYPTO_FURTHER_HELP_URL',
		},
		exchangeFactoryAddress: {
			doc: 'Exchange factory address.',
			format: String,
			default: '0xBCfCcbde45cE874adCB698cC183deBcF17952812',
			env: 'CRYPTO_EXCHANGE_FACTORY_ADDRESS',
		},
	},
	helpUrl: {
		doc: 'Message when a user asks for help.',
		format: String,
		default: 'https://pointdpal.com/help',
		env: 'FURTHER_HELP_URL',
	},
	scoreboard: {
		cron: {
			doc: 'Monthly scoreboard cron.',
			format: String,
			default: '0 10 1-7 * *',
			env: 'SCOREBOARD_CRON',
		},
		dayOfWeek: {
			doc: 'Monthly scoreboard day of week.',
			format: Number,
			default: 1,
			env: 'SCOREBOARD_DAY_OF_WEEK',
		},
		channel: {
			doc: 'The name of the room to post the scoreboard.',
			format: String,
			default: 'pointd-scoreboard',
			env: 'SCOREBOARD_CHANNEL',
		},
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
			doc: 'Slack state secret. (This is simply a randomly generated string by us [thx slack?])',
			format: String,
			sensitive: true,
			default: null,
			env: 'SLACK_STATE_SECRET',
		},
		appToken: {
			doc: 'Slack app token.',
			format: String,
			sensitive: true,
			default: null,
			env: 'SLACK_APP_TOKEN',
		},
	},
});

// Load environment dependent configuration
const env = config.get('env');
try {
	config.loadFile('./src/config/' + env + '.json');
} catch (e: unknown) {
	console.warn('No config file found for environment:[', env, ']', `\n${(e as Error).message}`, '\n');
}

// Perform validation
config.validate({ allowed: 'strict' });

export { config };
export default config;
