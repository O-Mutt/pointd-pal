/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
import type { AuditTags } from './auditTags';
import type { DBObjectConvertible } from './dbObjectToTypescript';

export interface IPointdPalConfig extends AuditTags, DBObjectConvertible {
	id: string;
	companyName?: string;
	isAprilFoolsDayEnabled: boolean;
	formalFeedbackModulo: number;
	formalFeedbackUrl?: string;
	notificationChannel: 'pointd-notifications' | string;
	falsePositiveChannel?: 'pointd-false-positive' | string;
	scoreboardChannel: 'pointd-scoreboard' | string;
	scoreboardCron?: string;
	tokenLedgerBalance: number;
}
// pointdPalAdmins?: string[];

export interface IPointdPalAdmins {
	id: string;
	teamId: string;
	adminId: string;
	configId: string;
}
