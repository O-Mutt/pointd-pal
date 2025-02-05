import * as installService from '@/services/installService';
import { withNamespace } from '@/logger';
import { createCronJob } from './cron';

const logger = withNamespace('monthlyScoreboardCron');
await (async () => {
	const allInstalls = await installService.findAll();

	for (const install of allInstalls) {
		logger.info(`Creating cron job for install ${install.id}`, install.teamId);
		const job = createCronJob(install);
		job.start();
	}
})();
