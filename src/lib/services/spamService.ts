import { withNamespace } from '@/logger';
import type { IUser } from '@/models';
import config from '@config';
import { eventBus, databaseService } from '@/lib/services';
import { PPSpamEventName, type PPSpamEvent } from '@/lib/types';
import { Md } from 'slack-block-builder';

export class SpamService {
	constructor(private logger = withNamespace('spamService')) {}

	async isSpam(teamId: string, recipient: IUser, sender: IUser) {
		this.logger.info(`Checking if`, sender, 'is spamming', recipient);
		const connection = await databaseService.getConnection(teamId);
		const nMinutesAgo = config.get('spam.timeout');
		// There is 1+ and that means we have spam
		const result = await connection.query<{ count: number }>(
			`
        SELECT COUNT(*) as count
        FROM score_logs
        WHERE
          "to" = '${recipient.id}' AND
          "from" = '${sender.id}' AND
          "date" >= now() - INTERVAL '${nMinutesAgo} MINUTES'
        `,
			[],
		);
		const isSpam = result.rows[0].count > 0;

		this.logger.info('spam check result', isSpam, result.rows[0], result.rows[0].count);

		if (isSpam) {
			const spamEvent: PPSpamEvent = {
				recipient,
				sender,
				notificationMessage: config.get('spam.responseMessage'),
				reason: `You recently sent ${Md.user(recipient.slackId)} a point.`,
				teamId,
			};

			eventBus.emit(PPSpamEventName, spamEvent);
		}
		return isSpam;
	}
}

export const spamService = new SpamService();
