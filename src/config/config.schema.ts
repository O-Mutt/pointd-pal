/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
import { LogLevel } from '@slack/web-api';

export class PointdPalConfig {
	baseUrl: string | 'https://pointdpal.okeefe.dev';
	port: number | 3000;
	env: 'development' | 'test' | 'production';
	logLevel: `${LogLevel}` | 'info';
	notificationsChannel: string | 'pointd-notifications';
	formalFeedbackModulo: number | 5;
	scoreKeywords: string[];
	reasonConjunctions: string[];
	spam: {
		responseMessage: string | 'Looks like you hit the spam filter. Please slow your roll.';
		timeout: number | 5;
	};
	postgres: {
		host: string | 'localhost';
		port: number | 5432;
		username: string | 'postgres';
		password: string | 'password';
		database: string | 'pointdpal';
		schema: string | 'pointdpal';
	};
	crypto?: {
		rpcProvider?: string | null;
		magicNumber?: string | null;
		magicIv?: string | null;
		exchangeFactoryAddress?: string | null;
		helpUrl: string | 'https://pointdpal.com/crypto/help';
	};
	helpUrl: string | 'https://pointdpal.com/help';
	scoreboard: {
		cron: string;
		dayOfWeek: number | 1;
		channel: string | 'pointd-scoreboard';
	};
	slack: {
		signingSecret: string;
		clientId: string;
		clientSecret: string;
		stateSecret: string;
		appToken: string;
	};
}
