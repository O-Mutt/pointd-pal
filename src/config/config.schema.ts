import { LogLevel } from '@slack/web-api';

export interface PointdPalConfig {
	env: string;
	logLevel: `${LogLevel}`;
	scoreKeywords: string[];
	reasonConjunctions: string[];
	spam: {
		responseMessage: string;
		timeout: number;
	};
	postgres: {
		host: string;
		port: number;
		database: string;
		username: string;
		password: string;
	};
	crypto?: {
		rpcProvider?: string | null;
		magicNumber?: string | null;
		magicIv?: string | null;
		exchangeFactoryAddress?: string | null;
		helpUrl: string;
	};
	helpUrl: string;
	scoreboard: {
		cron: string;
		dayOfWeek: number;
	};
	slack: {
		signingSecret: string;
		clientId: string;
		clientSecret: string;
		stateSecret: string;
	};
}
