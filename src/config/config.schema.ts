/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
import { LogLevel } from '@slack/web-api';

export class PointdPalConfig {
	port?: number | 5000 = 5000;
	env?: 'development' | 'test' | 'production' = 'development';
	logLevel?: `${LogLevel}` = 'info';
	scoreKeywords?: string[] = ['score', 'scores', 'karma'];
	reasonConjunctions?: string[] = ['for', 'because', 'cause', 'cuz', 'as', 'porque', 'just', 'thanks for', 'since'];
	spam?: {
		responseMessage: string | 'Looks like you hit the spam filter. Please slow your roll.';
		timeout: number | 5;
	} = {
		responseMessage: 'Looks like you hit the spam filter. Please slow your roll.',
		timeout: 5,
	};
	postgres?: {
		host: string | 'localhost';
		port: number | 5432;
		username: string | 'postgres';
		password: string | 'password';
		database: string | 'pointdpal';
	} = {
		host: 'localhost',
		port: 5432,
		username: 'postgres',
		password: 'password',
		database: 'pointdpal',
	};
	crypto?: {
		rpcProvider?: string | null;
		magicNumber?: string | null;
		magicIv?: string | null;
		exchangeFactoryAddress?: string | null;
		helpUrl: string | 'https://pointdpal.com/crypto/help';
	} = undefined;
	helpUrl: string | 'https://pointdpal.com/help' = 'https://pointdpal.com/help';
	scoreboard?: {
		cron: string;
		dayOfWeek: number;
	} = {
		cron: '0 10 1-7 * *',
		dayOfWeek: 1,
	};
	slack: {
		signingSecret: string;
		clientId: string;
		clientSecret: string;
		stateSecret: string;
	};
}
