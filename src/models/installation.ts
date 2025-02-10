import type { AuditTags } from '@/models/auditTags';
import type { Installation } from '@slack/bolt';

export interface IInstallation extends AuditTags {
	id: string;
	isEnabled: boolean;
	teamId: string;
	customerId: string;
	installation: Installation;
}
