import { AuditTags } from './auditTags';

export interface IPointdPalConfig extends AuditTags {
	id: string;
	notificationRoom?: string;
	falsePositiveRoom?: string;
	scoreboardRoom?: string;
	formalFeedbackUrl?: string;
	formalFeedbackModulo: number;
	companyName?: string;
	// pointdPalAdmins?: string[];
	tokenLedgerBalance: number;
}

export interface IPointdPalAdmins {
	id: string;
	teamId: string;
	adminId: string;
	configId: string;
}
