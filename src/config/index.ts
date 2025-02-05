import convict from 'convict';
import { PointdPalConfig } from './config.schema';

const config = convict<PointdPalConfig>({
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
		rpcProvider: {
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
			env: 'CRYPTO_MAGIC_NUMBER',
		},
		magicIv: {
			doc: 'Magic IV.',
			format: String,
			sensitive: true,
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
		default: {
			cron: '0 10 1-7 * *',
			dayOfWeek: 1,
		},
		cron: {
			doc: 'Monthly scoreboard cron.',
			format: String,
			default: '0 10 1-7 * *',
			env: 'MONTHLY_SCOREBOARD_CRON',
		},
		dayOfWeek: {
			doc: 'Monthly scoreboard day of week.',
			format: Number,
			default: 1,
			env: 'MONTHLY_SCOREBOARD_DAY_OF_WEEK',
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
			doc: 'Slack state secret.',
			format: String,
			sensitive: true,
			default: null,
			env: 'SLACK_STATE_SECRET',
		},
	},
});

// Load environment dependent configuration
const env = config.get('env');
config.loadFile('./config/' + env + '.json');

// Perform validation
config.validate({ allowed: 'strict' });

export { config };
export default config;
