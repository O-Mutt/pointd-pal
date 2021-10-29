import { app } from '../../../app';

export class SlackService {
  static async findOrCreateConversation(teamId: string, channelName: string): Promise<string | undefined> {
    let result;
    try {
      result = await app.client.conversations.list();
    } catch (e) {
      // logger.error(e)
      return;
    }

    const foundChannel = result.channels?.filter((channel) => {
      return channel.name === channelName;
    });

    if (foundChannel && foundChannel.length === 1) {
      return foundChannel[0].id;
    }

    try {
      const { channel } = await app.client.conversations.create({ team_id: teamId, name: channelName });
      return channel?.id;
    } catch (e) {
      // logger.error(e)
      return;
    }
  }
}