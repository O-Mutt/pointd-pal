import { ConversationsListResponse } from '@slack/web-api';
import { app } from '../../../app';

export async function findOrCreateConversation(
	token?: string,
	teamId?: string,
	channelName?: string,
): Promise<string | undefined> {
	if (!token || !teamId || !channelName) {
		return;
	}
	let result: ConversationsListResponse | undefined = undefined;
	try {
		result = await app.client.conversations.list({ token: token, team_id: teamId });
	} catch (e: unknown) {
		// logger.error(e)
		logger.error('Error getting list of conversations', e.message);
	}

	if (!result || !result.channels) {
		logger.info(`Could not get channels for Team ${teamId}. We were looking for ${channelName}`);
		return;
	}

	const foundChannel = result.channels.filter((channel) => {
		return channel.name === channelName;
	});

	if (foundChannel && foundChannel.length === 1) {
		// make sure we're in the channel
		try {
			await app.client.conversations.join({ token: token, channel: foundChannel[0].id as string });
		} catch (e: unknown) {
			// logger.error(e)
			logger.error(
				"This may be a known error and we should probably check for the e.warning === 'already_in_channel' but:",
				e.message,
			);
			return;
		}
		return foundChannel[0].id;
	}

	try {
		const { channel } = await app.client.conversations.create({ token: token, team_id: teamId, name: channelName });
		return channel?.id;
	} catch (e: unknown) {
		// logger.error(e)
		logger.error('Error creating the conversation for notifications', e.message);
		return;
	}
}
