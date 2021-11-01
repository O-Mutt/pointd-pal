import { ChatPostMessageArguments } from '@slack/web-api';
import clark from 'clark';
import { CronJob } from 'cron';
import ImageCharts from 'image-charts';
import _ from 'lodash';
import moment from 'moment';
import { Blocks, Md, Message } from 'slack-block-builder';

import { app } from '../app';
import { Helpers as H } from './lib/helpers';
import { Installation } from './lib/models/installation';
import { QraftyConfig } from './lib/models/qraftyConfig';
import { connectionFactory } from './lib/services/connectionsFactory';
import { DatabaseService } from './lib/services/database';
import { SlackService } from './lib/services/slack';

const procVars = H.getProcessVariables(process.env);
const databaseService = new DatabaseService({ ...procVars });

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

          const topSenderMessage = buildChartMessage(channelId, `Qrafty 10 Qrafty Point Senders over the last month`, topSenders, messages);
          try {
            const result = await app.client.chat.postMessage({ token: botToken, ...topSenderMessage } as ChatPostMessageArguments);
          } catch (e: any) {
            console.error('error', e.data.response_metadata.message);
          }


          // Recipients
          const topRecipients = await databaseService.getTopReceiverInDuration(connection, 10, 30);
          messages = [];
          rank = 1;
          for (const recipient of topRecipients) {
            const pointStr = `point${H.getEsOnEndOfWord(recipient.scoreChange)} given`;
            console.log(`Top room [i] ${JSON.stringify(topRecipients)}[${rank}]`);
            messages.push(`${rank}. ${Md.user(recipient._id)} (${recipient.scoreChange} ${pointStr})`);
            rank++;
          }

          const topRecipientMessage = buildChartMessage(channelId, `Top 10 Qrafty Point Recipients over the last month`, topRecipients, messages);
          try {
            const result = await app.client.chat.postMessage({ token: botToken, ...topRecipientMessage } as ChatPostMessageArguments);
          } catch (e: any) {
            console.error('error', e.data.response_metadata.message);
          }

          // Channel
          const topRooms = await databaseService.getTopRoomInDuration(connection, 3, 30);
          messages = [];
          rank = 1;
          for (const room of topRooms) {
            const pointStr = `point${H.getEsOnEndOfWord(room.scoreChange)} given`;
            console.log(`Top room [i] ${JSON.stringify(topRooms)}[${rank}]`);
            messages.push(`${rank}. ${Md.channel(room._id)} (${room.scoreChange} ${pointStr})`);
            rank++;
          }

          const topRoomMessage = buildChartMessage(channelId, `Top 3 Channels that sent the most Qrafty Point over the last month`, topRooms, messages, true);
          try {
            const result = await app.client.chat.postMessage({ token: botToken, ...topRoomMessage } as ChatPostMessageArguments);
          } catch (e: any) {
            console.error('error', e.data.response_metadata.message);
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

function buildChartMessage(channel: string, title: string, tops: any[], messages: string[], isChannel: boolean = false) {
  const chartText = title;
  const graphSize = Math.min(tops.length, Math.min(10, 20));
  const chartUrl = new ImageCharts()
    .cht('bvg')
    .chs('999x200')
    .chtt(chartText)
    .chxt('x,y')
    .chxl(`0:|${_.take(_.map(tops, (top) => isChannel ? Md.channel(top._id) : Md.user(top._id)), graphSize).join('|')}`)
    .chd(`a:${_.take(_.map(tops, 'score'), graphSize).join(',')}`)
    .toURL();

  const theMessage = Message({ channel: channel, text: chartText })
    .blocks(
      Blocks.Header({ text: chartText }),
      Blocks.Image({ imageUrl: chartUrl, altText: chartText }),
      Blocks.Section({ text: messages.join('\n') }),
    )
    .asUser()
    .buildToObject();
  return theMessage;
}