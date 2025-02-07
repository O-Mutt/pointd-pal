import { PointdPalConfig } from './config.schema';

const config: PointdPalConfig = {
	baseUrl: 'https://pointdpal.okeefe.dev', // base url
	env: 'development', // environment
	port: 3000, // web port
	logLevel: 'info', // log level
	scoreKeywords: ['score', 'points', 'point', 'scores'], // keywords to check for score e.g. "how many points does @Xuser have?"
	reasonConjunctions: ['for', 'because', 'due to', 'as a result of'], // conjunctions to check for reason e.g. "@XUser++ for being amazing"
	spam: {
		responseMessage: 'Please do not spam the bot. If you have any questions, please ask them in the #general channel.', // spam response message
		timeout: 5, // time in minutes a user can be considered spamming points
	},
	postgres: {
		host: 'localhost', // postgres host
		port: 5432, // postgres port
		database: 'pointdpal', // the root database to use for installations and baseline config (tenants will get their own)
		username: 'pointdpal', // postgres username
		password: 'test123', // postgres password
		schema: 'pointdpal', // postgres schema
	},
	// this whole section is optional
	crypto: {
		rpcProvider: '', // optional rpc provider for crypto
		magicNumber: '', // optional magic number for crypto
		magicIv: '', // optional magic iv for crypto
		exchangeFactoryAddress: '', // optional exchange factory address for crypto
		helpUrl: '', // optional help url for further help related directly to crypto
	},
	helpUrl: '', //
	scoreboard: {
		cron: '', // cron notation for the monthly scoreboard
		dayOfWeek: 1, // the day of the week Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6
	},
	slack: {
		signingSecret: '',
		clientId: '',
		clientSecret: '',
		stateSecret: '',
		appToken: '',
	},
};

export { config };
export default config;
