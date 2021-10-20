import clark from 'clark';
import moment from 'moment';
import _ from 'lodash';
import { CronJob } from 'cron';

import { app } from '../app';

import { Helpers } from './lib/helpers';
import { DatabaseService } from './lib/services/database';

const procVars = Helpers.getProcessVariables(process.env);
const databaseService = new DatabaseService({ ...procVars });

(() => {
  if (!procVars.notificationsRoom) {
    return;
  }

  const { monthlyScoreboardCron, monthlyScoreboardDayOfWeek } = procVars;
  const job = new CronJob(
    monthlyScoreboardCron,
    async () => {
      if (isScoreboardDayOfWeek()) {
        //Logger.debug('running the cron job');

        // Senders
        const topSenders = await databaseService.getTopSenderInDuration('123', 10, 30);
        let messages: string[] = [];
        if (topSenders.length > 0) {
          for (let i = 0, end = topSenders.length - 1, asc = end >= 0; asc ? i <= end : i >= end; asc ? i++ : i--) {
            const person = `<@${topSenders[i].slackId}>`;
            const pointStr = topSenders[i].scoreChange > 1 ? 'points given' : 'point given';
            messages.push(`${i + 1}. ${person} (${topSenders[i].scoreChange} ${pointStr})`);
          }
        } else {
          messages.push('No scores to keep track of yet!');
        }

        let graphSize = Math.min(topSenders.length, Math.min(10, 20));
        messages.splice(0, 0, clark(_.take(_.map(topSenders, 'scoreChange'), graphSize)));
        messages.splice(0, 0, `:tada: The top 10 ${'qrafty'} point senders over the last month! :tada:`);

        await app.client.chat.postMessage({
          channel: procVars.notificationsRoom,
          text: messages.join('\n'),
        });

        // Recipients
        const topRecipient = await databaseService.getTopReceiverInDuration('123', 10, 30);
        messages = [];
        if (topRecipient.length > 0) {
          for (let i = 0, end = topRecipient.length - 1, asc = end >= 0; asc ? i <= end : i >= end; asc ? i++ : i--) {
            const person = `<@${topRecipient[i].slackId}>`;
            const pointStr = topRecipient[i].scoreChange > 1 ? 'points received' : 'point received';
            messages.push(`${i + 1}. ${person} (${topRecipient[i].scoreChange} ${pointStr})`);
          }
        } else {
          messages.push('No scores to keep track of yet!');
        }

        graphSize = Math.min(topRecipient.length, Math.min(10, 20));
        messages.splice(0, 0, clark(_.take(_.map(topRecipient, 'scoreChange'), graphSize)));
        messages.splice(0, 0, `:tada: The top 10 ${'qrafty'} point recipients over the last month! :tada:`);
        await app.client.chat.postMessage({
          channel: procVars.notificationsRoom,
          text: messages.join('\n'),
        });

        // Channel
        const topRoom = await databaseService.getTopRoomInDuration('123', 3, 30);
        messages = [];
        if (topRoom.length > 0) {
          for (let i = 0, end = topRoom.length - 1, asc = end >= 0; asc ? i <= end : i >= end; asc ? i++ : i--) {
            const person = `<#${topRoom[i].slackId}>`;
            const pointStr = topRoom[i].scoreChange > 1 ? 'points given' : 'point given';
            messages.push(`${i + 1}. ${person} (${topRoom[i].scoreChange} ${pointStr})`);
          }
        } else {
          messages.push('No scores to keep track of yet!');
        }

        graphSize = Math.min(topRoom.length, Math.min(10, 20));
        messages.splice(0, 0, clark(_.take(_.map(topRoom, 'scoreChange'), graphSize)));
        messages.splice(0, 0, `:tada: The top 3 rooms that sent ${'qrafty'} point(s) over the last month! :tada:`);
        await app.client.chat.postMessage({
          channel: procVars.notificationsRoom,
          text: messages.join('\n'),
        });
      }
    },
    null,
    true,
    'America/Chicago',
  );
  job.start();

  function isScoreboardDayOfWeek() {
    //Logger.debug(`Run the cron but lets check what day it is Moment day: [${moment().day()}], Configured Day of Week: [${monthlyScoreboardDayOfWeek}], isThatDay: [${moment().day() === monthlyScoreboardDayOfWeek}]`);
    const isToday = moment().day() === monthlyScoreboardDayOfWeek;
    return isToday;
  }
})();
