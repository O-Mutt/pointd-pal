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
  // somehow we need a team id... maybe loop all the teams for the cron? Cron per instance?
  /* const config = await QraftyConfig(connectionFactory(teamId)).findOne().exec();
  const channelId = await SlackService.findOrCreateConversation(config?.notificationRoom);
  if (!channelId) {
    return;
  } */
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

          // Senders
          const topSenders = await databaseService.getTopSenderInDuration(connection, 10, 30);
          let messages: string[] = [];
          if (topSenders.length > 0) {
            for (let i = 0, end = topSenders.length - 1, asc = end >= 0; asc ? i <= end : i >= end; asc ? i++ : i--) {
              const pointStr = `point${H.getEsOnEndOfWord(topSenders[i].scoreChange)} given`;
              messages.push(`${i + 1}. ${Md.user(topSenders[i].slackId)} (${topSenders[i].scoreChange} ${pointStr})`);
            }
          } else {
            messages.push('No scores to keep track of yet!');
          }

          const topSenderMessage = buildChartMessage(channelId, `Qrafty 10 Qrafty Point Senders over the last month`, topSenders, messages);
          try {
            const result = await app.client.chat.postMessage({ token: botToken, ...topSenderMessage } as ChatPostMessageArguments);
          } catch (e: any) {
            console.error('error', e.data.response_metadata.message);
          }


          // Recipients
          const topRecipient = await databaseService.getTopReceiverInDuration(connection, 10, 30);
          messages = [];
          if (topRecipient.length > 0) {
            for (let i = 0, end = topRecipient.length - 1, asc = end >= 0; asc ? i <= end : i >= end; asc ? i++ : i--) {
              const pointStr = `point${H.getEsOnEndOfWord(topRecipient[i].scoreChange)} received`;
              messages.push(`${i + 1}. ${Md.user(topRecipient[i].slackId)} (${topRecipient[i].scoreChange} ${pointStr})`);
            }
          } else {
            messages.push('No scores to keep track of yet!');
          }

          const topRecipientMessage = buildChartMessage(channelId, `Top 10 Qrafty Point Recipients over the last month`, topRecipient, messages);
          try {
            const result = await app.client.chat.postMessage({ token: botToken, ...topRecipientMessage } as ChatPostMessageArguments);
          } catch (e: any) {
            console.error('error', e.data.response_metadata.message);
          }

          // Channel
          const topRoom = await databaseService.getTopRoomInDuration(connection, 3, 30);
          messages = [];
          if (topRoom.length > 0) {
            for (let i = 0, end = topRoom.length - 1, asc = end >= 0; asc ? i <= end : i >= end; asc ? i++ : i--) {
              const pointStr = `point${H.getEsOnEndOfWord(topRoom[i].scoreChange)} given`;
              messages.push(`${i + 1}. ${Md.channel(topRoom[i].slackId)} (${topRoom[i].scoreChange} ${pointStr})`);
            }
          } else {
            messages.push('No scores to keep track of yet!');
          }

          const topRoomMessage = buildChartMessage(channelId, `Top 3 Channels that sent the most Qrafty Point over the last month`, topRoom, messages);
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

function buildChartMessage(channel: string, title: string, tops: any[], messages: string[]) {
  const chartText = title;
  const graphSize = Math.min(tops.length, Math.min(10, 20));
  const chartUrl = new ImageCharts()
    .cht('bvg')
    .chs('999x200')
    .chtt(chartText)
    .chxt('x,y')
    .chxl(`0:|${_.take(_.map(tops, 'name'), graphSize).join('|')}`)
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