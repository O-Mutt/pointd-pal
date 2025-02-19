import type { IInstallation } from '@/models';
import type { CronJob } from 'cron';

export interface CronWorkerEntry {
	teamId: string;
	install: IInstallation;
	cron: CronJob;
}
