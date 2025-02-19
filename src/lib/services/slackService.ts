import { withNamespace } from '@/logger';
import type { ConversationsListResponse } from '@slack/web-api';

import { app } from '@/app';
import { userService } from '.';
import type { IUser } from '@/models';

export class SlackService {
	constructor(private logger = withNamespace('slackService')) {}

	async getOrCreateConversation(token: string, teamId: string, channelName: string): Promise<string | null> {
		let result: ConversationsListResponse | undefined = undefined;
		try {
			result = await app.client.conversations.list({ token, team_id: teamId });
		} catch (e: unknown) {
			this.logger.error('Error getting list of conversations', (e as Error).message);
		}

		if (!result || !result.channels) {
			this.logger.info('Could not get channels for the team.', teamId, 'We were looking for the channel', channelName);
			return null;
		}

		let foundChannel = result.channels.filter((channel) => {
			return channel.name === channelName || channel.id === channelName;
		});

		if (!foundChannel || foundChannel.length === 0) {
			try {
				this.logger.info('Creating the conversation', channelName);
				const { channel } = await app.client.conversations.create({ token, team_id: teamId, name: channelName });
				foundChannel = channel ? [channel] : [];
			} catch (e: unknown) {
				// logger.error(e)
				this.logger.error('Error creating the conversation for notifications', (e as Error).message);
				return null;
			}
		}

		if (foundChannel && foundChannel.length === 1) {
			// make sure we're in the channel
			try {
				await app.client.conversations.join({ token, channel: foundChannel[0].id! });
			} catch (e: unknown) {
				// logger.error(e)
				this.logger.error(
					"This may be a known error and we should probably check for the e.warning === 'already_in_channel' but:",
					(e as Error).message,
				);
				return null;
			}
			return foundChannel[0].id!;
		}

		return null;
	}

	async getAdmins(teamId: string, token: string): Promise<IUser[]> {
		let admins: IUser[] = [];
		try {
			const slackAdmins = (await app.client.users.list({ token, team_id: teamId }))?.members?.filter(
				(user) => user.is_admin === true,
			);
			if (slackAdmins) {
				admins = await userService.upsert(teamId, admins);
			}
		} catch (e: unknown) {
			this.logger.error('Error getting list of admins', (e as Error).message);
		}

		return admins;
	}

	async getPermalinkToMessage(token: string, channel: string, message_ts: string): Promise<string | null> {
		try {
			this.logger.info('look up the permalink', channel, message_ts);
			const { permalink } = await app.client.chat.getPermalink({
				token,
				channel,
				message_ts,
			});
			return permalink!;
		} catch (e: unknown) {
			this.logger.error('There was an error getting the permalink', (e as Error).message);
		}
		return null;
	}
}

export const slackService = new SlackService();
