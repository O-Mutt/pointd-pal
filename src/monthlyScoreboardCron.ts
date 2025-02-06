import * as installService from '@/lib/services/installService';
import { withNamespace } from '@/logger';
import { createCronJob } from './cron';

const logger = withNamespace('monthlyScoreboardCron');
void (async () => {
	try {
		const allInstalls = await installService.findAll();

		for (const install of allInstalls) {
			logger.info(`Creating cron job for install ${install.id}`, install.teamId);
			const job = createCronJob(install);
			job.start();
		}
	} catch (e) {
		logger.error('Error creating cron job', e);
	}
})();
