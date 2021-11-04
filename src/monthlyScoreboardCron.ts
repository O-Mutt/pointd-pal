import { ChatPostMessageArguments } from '@slack/web-api';
import clark from 'clark';
import { CronJob } from 'cron';
import ImageCharts from 'image-charts';
import _ from 'lodash';
import moment from 'moment';
import { Appendable, BlockBuilder, Blocks, Md, Message } from 'slack-block-builder';

import { app } from '../app';
import { Helpers as H } from './lib/helpers';
import { Installation } from './lib/models/installation';
import { QraftyConfig } from './lib/models/qraftyConfig';
import { connectionFactory } from './lib/services/connectionsFactory';
import { DatabaseService } from './lib/services/database';
import { SlackService } from './lib/services/slack';

const procVars = H.getProcessVariables(process.env);
const databaseService = new DatabaseService();

(async () => {
  const allInstalls = await Installation.find({}).exec();

  for (const install of allInstalls) {
    const { monthlyScoreboardCron, monthlyScoreboardDayOfWeek } = procVars;
    const job = new CronJob(
      monthlyScoreboardCron,
      async () => {
        const teamId = install?.teamId;
        const botToken = install?.installation.bot?.token;
        if (!teamId || !botToken) {
          return;
        }
        const connection = connectionFactory(teamId);
        const qraftyConfig = await QraftyConfig(connection).findOne().exec();
        if (!qraftyConfig) {
          return;
        }
        const scoreboardRoom = qraftyConfig.scoreboardRoom;
        const channelId = await SlackService.findOrCreateConversation(botToken, teamId, scoreboardRoom);
        if (!channelId) {
          return;
        }
        if (H.isScoreboardDayOfWeek(monthlyScoreboardDayOfWeek)) {
          //Logger.debug('running the cron job');

          let rank: number = 0;
          // Senders
          const topSenders = await databaseService.getTopSenderInDuration(connection, 10, 30);
          let messages: string[] = [];
          rank = 1;
          for (const sender of topSenders) {
            const pointStr = `point${H.getEsOnEndOfWord(sender.scoreChange)} given`;
            console.log(`Top room [i] ${JSON.stringify(topSenders)}[${rank}]`);
            messages.push(`${rank}. ${Md.user(sender._id)} (${sender.scoreChange} ${pointStr})`);
            rank++;
          }
          const topSenderBlocks = buildBlocks(`Top 10 Qrafty Point Senders`, topSenders, messages);

          // Recipients
          const topRecipients = await databaseService.getTopReceiverInDuration(connection, 10, 30);
          messages = [];
          rank = 1;
          for (const recipient of topRecipients) {
            const pointStr = `point${H.getEsOnEndOfWord(recipient.scoreChange)} received`;
            console.log(`Top room [i] ${JSON.stringify(topRecipients)}[${rank}]`);
            messages.push(`${rank}. ${Md.user(recipient._id)} (${recipient.scoreChange} ${pointStr})`);
            rank++;
          }
          const topRecipientBlocks = buildBlocks(`Top 10 Qrafty Point Recipients`, topRecipients, messages);

          // Channel
          let topRooms = await databaseService.getTopRoomInDuration(connection, 3, 30);
          messages = [];
          rank = 1;
          for (const room of topRooms) {
            console.log('find the room', room);
            const { channel } = await app.client.conversations.info({ token: botToken, channel: room._id });
            if (channel) {
              room.name = channel.name;
            }
            const pointStr = `point${H.getEsOnEndOfWord(room.scoreChange)} given`;
            console.log(`Top room [i] ${JSON.stringify(topRooms)}[${rank}]`);
            messages.push(`${rank}. ${Md.channel(room._id)} (${room.scoreChange} ${pointStr})`);
            rank++;
          }

          const topRoomBlocks = buildBlocks(`Top 3 Qrafty Point Channels`, topRooms, messages);
          const theMessage = Message({ channel: channelId, text: 'Monthly Qrafty Scoreboard' })
            .blocks(
              Blocks.Header({ text: 'Monthly Qrafty Scoreboard' }),
              Blocks.Divider(),
              ...topSenderBlocks,
              Blocks.Divider(),
              ...topRecipientBlocks,
              Blocks.Divider(),
              ...topRoomBlocks,
            )
            .asUser();

          try {
            const result = await app.client.chat.postMessage({ token: botToken, ...theMessage.buildToObject() } as ChatPostMessageArguments);
          } catch (e: any) {
            console.error('error', e.data.response_metadata.message, theMessage.printPreviewUrl());
          }

        }
      },
      null,
      true,
      'America/Chicago',
    );
    job.start();
  }
})();

function buildBlocks(title: string, tops: any[], messages: string[]) {
  const graphSize = Math.min(tops.length, Math.min(10, 20));
  const chartUrl = new ImageCharts()
    .cht('bvg')
    .chs('999x200')
    .chtt(title)
    .chxt('x,y')
    .chxl(`0:|${_.take(_.map(tops, 'name'), graphSize).join('|')}`)
    .chd(`a:${_.take(_.map(tops, 'scoreChange'), graphSize).join(',')}`)
    .toURL();

  let blocks: Appendable<BlockBuilder> = [
    Blocks.Section({ text: Md.bold(Md.italic(title)) }),
    Blocks.Image({ imageUrl: chartUrl, altText: title }),
    Blocks.Section({ text: messages.join('\n') })
  ];
  return blocks;
}