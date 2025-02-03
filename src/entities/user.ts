import { AuditTags } from './auditTags';

export interface IUser extends AuditTags {
	id: string;
	teamId: string;
	slackId: string;
	score: number;
	reasons: Map<string, number>;
	pointsGiven: Map<string, number>;
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
