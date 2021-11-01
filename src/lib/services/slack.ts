import { app } from '../../../app';

export class SlackService {
  static async findOrCreateConversation(token?: string, teamId?: string, channelName?: string): Promise<string | undefined> {
    if (!token || !teamId || !channelName) {
      return;
    }
    let result;
    try {
      result = await app.client.conversations.list({ token: token });
    } catch (e: any | unknown) {
      // logger.error(e)
      console.error('Error getting list of conversations', e.message);
    }

    const foundChannel = result.channels?.filter((channel) => {
      return channel.name === channelName;
    });

    if (foundChannel && foundChannel.length === 1) {
      // make sure we're in the channel
      try {
        await app.client.conversations.join({ token: token, channel: foundChannel[0].id })
      } catch (e: any | unknown) {
        // logger.error(e)
        console.error('This may be a known error and we should probably check for the e.warning === \'already_in_channel\' but:', e.message);
        return
      }
      return foundChannel[0].id;
    }

    try {
      const { channel } = await app.client.conversations.create({ token: token, team_id: teamId, name: channelName });
      return channel?.id;
    } catch (e: any | unknown) {
      // logger.error(e)
      console.error('Error creating the conversation for notifications', e.message);
      return
    }
  }
}
