import { installService } from '@/lib/services/installService';
import { withNamespace } from '@/logger';
import { createOrUpdateCronJob } from '../cron';
import type { CronWorkerEntry } from '@/cron/types/CronWorkerEntry';
import { ConfigService, configService as cs, SlackService, slackService as ss } from '@/lib/services';

class ScoreboardWorker {
	constructor(
		private logger = withNamespace('monthlyScoreboardCron'),
		private workerJobs: Record<string, CronWorkerEntry> = {},
		private slackService: SlackService = ss,
		private configService: ConfigService = cs,
	) {}

	private async ensureChannelsExist(cronWorkerEntry: CronWorkerEntry) {
		const currentToken =
			cronWorkerEntry.install.installation.bot?.token ?? cronWorkerEntry.install.installation.user?.token;
		const config = await this.configService.getOrCreate(cronWorkerEntry.teamId);
		await this.slackService.getOrCreateConversation(currentToken!, cronWorkerEntry.teamId, config.scoreboardChannel);
	}

	async startAllWorkers() {
		try {
			const allInstalls = await installService.findAll();

			const promises: Promise<CronWorkerEntry>[] = [];
			for (const install of allInstalls) {
				this.logger.info('Creating cron job for install', install.id, 'The team id', install.teamId);
				promises.push(createOrUpdateCronJob(install));
			}

			const jobs = await Promise.allSettled(promises);
			this.logger.info('Cron jobs created', jobs);
			for (const job of jobs) {
				if (job.status === 'rejected') {
					this.logger.error('Error creating cron job', job.reason);
					continue;
				}

				this.workerJobs[job.value.teamId] = job.value;
				this.workerJobs[job.value.teamId].cron.start();
				await this.ensureChannelsExist(this.workerJobs[job.value.teamId]);
			}
		} catch (e) {
			this.logger.error('Error creating cron job', e);
		}
	}
}

export const scoreboardWorker = new ScoreboardWorker();
