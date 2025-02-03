import { AuditTags } from '@/entities/auditTags';
import { Installation } from '@slack/bolt';

export interface IInstallation extends AuditTags {
	id: string;
	isEnabled: boolean;
	teamId: string;
	customerId: string;
	installation: Installation;
}
