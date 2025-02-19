import type { AuditTags } from './auditTags';
import type { DBObjectConvertible } from './dbObjectToTypescript';

export interface IUser extends AuditTags, DBObjectConvertible {
	id: string;
	teamId: string;
	slackId: string;
	score: number;
	reasons: Record<string, number>;
	pointsGiven: Record<string, number>;
	pointdPalDay: Date;
	accountLevel: number;
	totalPointsGiven: number;
	isAdmin: boolean;
	isBot: boolean;
	token: number;
	email?: string;
	name?: string;
	walletAddress?: string;
}
