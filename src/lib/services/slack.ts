import { app } from '../../../app';

export class SlackService {
  static async findOrCreateConversation(channelName?: string): Promise<string | undefined> {
    if (!channelName) {
      return;
    }

    const result = await app.client.conversations.list();
    const foundChannel = result.channels?.filter((channel) => {
      channel.name === channelName;
    });

    if (foundChannel && foundChannel.length === 1) {
      return foundChannel[0].id;
    }

    try {
      const { channel } = await app.client.conversations.create({ name: channelName });
      return channel?.id;
    } catch (e) {
      // logger error (e)
      return;
    }
  }
}
