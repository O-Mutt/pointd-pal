import { LogLevel } from '@slack/web-api';

export interface PointdPalConfig {
	env: string;
	logLevel: `${LogLevel}`;
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
		cryptoRpcProvider?: string | null;
		magicNumber?: string | null;
		magicIv?: string | null;
	};
	helpMessage?: string;
	scoreboard?: {
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
