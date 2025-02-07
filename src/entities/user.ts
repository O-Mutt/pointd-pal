import { type AuditTags } from './auditTags';

export interface IUser extends AuditTags {
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
