import type { DBObjectConvertible } from './dbObjectToTypescript';

export interface IBotToken extends DBObjectConvertible {
	id?: number;
	enabled: boolean;
	name: string;
	publicWalletAddress: string;
	token: number;
	magicString: string;
}
