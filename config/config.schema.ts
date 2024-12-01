import { LogLevel } from '@slack/web-api';

export interface PointdPalConfig {
	spamMessage: string;
	spamTimeLimit: number;
	mongoUri: string;
	cryptoRpcProvider: string | null;
	magicNumber: string | null;
	magicIv: string | null;
	furtherHelpUrl: string | null;
	monthlyScoreboardCron: string;
	monthlyScoreboardDayOfWeek: number;
	defaultDb: string | null;
	slack: {
		signingSecret: string;
		clientId: string;
		clientSecret: string;
		stateSecret: string;
	};
	logLevel: `${LogLevel}`;
}
