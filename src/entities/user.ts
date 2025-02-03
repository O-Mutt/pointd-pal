import { AuditTags } from './auditTags';
import { Installation } from './installation';

export interface IUser extends AuditTags {
	id: string;
	slackId: string;
	score: number;
	reasons: Record<string, number>;
	pointsGiven: Record<string, number>;
	pointdPalDay: Date;
	accountLevel: number;
	totalPointsGiven: number;
	isAdmin: boolean;
	isBot: boolean;
	pointdPalToken: number;
	email?: string;
	name?: string;
	walletAddress?: string;
}
