import _ from 'lodash';
import moment from 'moment';
import ImageCharts from 'image-charts';

import { directMention } from '@slack/bolt';

import { app } from '../app';
import { Helpers } from './lib/helpers';
import { regExpCreator } from './lib/regexpCreator';
import { DatabaseService } from './lib/services/database';
import { Blocks, Md, Message } from 'slack-block-builder';
import { ChatPostMessageArguments } from '@slack/web-api';

const procVars = Helpers.getProcessVariables(process.env);
const databaseService = new DatabaseService({ ...procVars });

app.message(regExpCreator.createAskForScoreRegExp(), directMention(), respondWithScore);
app.message(regExpCreator.createTopBottomRegExp(), directMention(), respondWithLeaderLoserBoard);
app.message(regExpCreator.createTopBottomTokenRegExp(), directMention(), respondWithLeaderLoserTokenBoard);
app.message(regExpCreator.createTopPointGiversRegExp(), directMention(), getTopPointSenders);

async function respondWithScore({ message, context, say }) {
  const { userId } = context.matches.groups;
  const teamId = context.teamId;
  const user = await databaseService.getUser(teamId, userId);

  let tokenString = '.';
  if (user.accountLevel > 1) {
    tokenString = ` (*${user.token} ${Helpers.capitalizeFirstLetter('qrafty')} `;
    tokenString = tokenString.concat(user.token && user.token > 1 ? 'Tokens*).' : 'Token*).');
  }

  const scoreStr = user.score > 1 ? 'points' : 'point';
  let baseString = `${Md.user(user.slackId)} has ${user.score} ${scoreStr}${tokenString}`;
  baseString += `\nAccount Level: ${user.accountLevel}`;
  baseString += `\nTotal Points Given: ${user.totalPointsGiven}`;
  if (user.robotDay) {
    const dateObj = new Date(user.robotDay);
    baseString += `\n:birthday: ${Helpers.capitalizeFirstLetter('qrafty')}day is ${moment(dateObj).format(
      'MM-DD-yyyy',
    )}`;
  }
  const keys = Object.keys(user.reasons);
  if (keys.length > 1) {
    const sampleReasons = {};
    const maxReasons = keys.length >= 5 ? 5 : keys.length;
    do {
      const randomNumber = _.random(0, keys.length - 1);
      const reason = keys[randomNumber];
      const value = user.reasons.get(keys[randomNumber]);
      sampleReasons[reason] = value;
    } while (Object.keys(sampleReasons).length < maxReasons);

    const reasonMap = _.reduce(
      sampleReasons,
      (memo, val, key) => {
        const decodedKey = Helpers.decode(key);
        const pointStr = val > 1 ? 'points' : 'point';
        memo += `\n_${decodedKey}_: ${val} ${pointStr}`;
        return memo;
      },
      '',
    );

    return await say(`${baseString}\n\n:star: Here are some reasons :star:${reasonMap}`);
  }
  return await say(`${baseString}`);
}

async function respondWithLeaderLoserBoard({ client, message, context, logger, say }) {
  const { topOrBottom, digits }: { topOrBottom: string; digits: number } = context.matches.groups;
  const teamId = context.teamId;
  const topOrBottomString = Helpers.capitalizeFirstLetter(topOrBottom);
  const methodName = `get${topOrBottomString}Scores`;
  const tops = await databaseService[methodName](teamId, digits);

  const messages: string[] = [];
  if (tops.length > 0) {
    for (let i = 0, end = tops.length - 1, asc = end >= 0; asc ? i <= end : i >= end; asc ? i++ : i--) {
      if (tops[i].accountLevel && tops[i].accountLevel > 1) {
        const tokenStr = tops[i].token > 1 ? 'Tokens' : 'Token';
        messages.push(
          `${i + 1}. ${Md.user(tops[i].slackId)}: ${tops[i].score} (*${tops[i].token} ${Helpers.capitalizeFirstLetter(
            'qrafty',
          )} ${tokenStr}*)`,
        );
      } else {
        messages.push(`${i + 1}. ${Md.user(tops[i].slackId)}: ${tops[i].score}`);
      }
    }
  } else {
    messages.push('No scores to keep track of yet!');
  }

  const chartText = `Qrafty ${topOrBottomString} ${digits} Score(s)`;
  const graphSize = Math.min(tops.length, Math.min(digits, 20));
  const chartUrl = new ImageCharts()
    .cht('bvg')
    .chs('999x200')
    .chtt(chartText)
    .chxt('x,y')
    .chxl(`0:|${_.take(_.map(tops, 'name'), graphSize).join('|')}`)
    .chd(`a:${_.take(_.map(tops, 'score'), graphSize).join(',')}`)
    .toURL();

  const theMessage = Message({ channel: message.channel, text: chartText })
    .blocks(
      Blocks.Header({ text: chartText }),
      Blocks.Image({ imageUrl: chartUrl, altText: chartText }),
      Blocks.Section({ text: messages.join('\n') }),
    )
    .asUser()
    .buildToObject();

  try {
    const result = await client.chat.postMessage(theMessage as ChatPostMessageArguments);
  } catch (e: any) {
    console.error('error', e.data.response_metadata.message);
  }
}

async function respondWithLeaderLoserTokenBoard({ message, context, client }) {
  const { topOrBottom, digits }: { topOrBottom: string; digits: number } = context.matches.groups;
  const teamId = context.teamId;
  const topOrBottomString = Helpers.capitalizeFirstLetter(topOrBottom);
  const methodName = `get${topOrBottomString}Tokens`;
  const tops = await databaseService[methodName](teamId, digits);

  const messages: string[] = [];
  if (tops.length > 0) {
    for (let i = 0, end = tops.length - 1, asc = end >= 0; asc ? i <= end : i >= end; asc ? i++ : i--) {
      const tokenStr = tops[i].token > 1 ? 'Tokens' : 'Token';
      const pointStr = tops[i].score > 1 ? 'points' : 'point';
      messages.push(
        `${i + 1}. ${Md.user(tops[i].slackId)}: *${tops[i].token} ${Helpers.capitalizeFirstLetter('qrafty')} ${tokenStr}* (${tops[i].score
        } ${pointStr})`,
      );
    }
  } else {
    messages.push('No scores to keep track of yet!');
  }

  const chartText = `Qrafty ${topOrBottomString} ${digits} Token(s)`;
  const graphSize = Math.min(tops.length, Math.min(digits, 20));
  const chartUrl = new ImageCharts()
    .cht('bvg')
    .chs('999x200')
    .chtt(chartText)
    .chxt('x,y')
    .chxl(`0:|${_.take(_.map(tops, 'name'), graphSize).join('|')}`)
    .chd(`a:${_.take(_.map(tops, 'token'), graphSize).join(',')}`)
    .toURL();

  const theMessage = Message({ channel: message.channel, text: chartText })
    .blocks(
      Blocks.Header({ text: chartText }),
      Blocks.Image({ imageUrl: chartUrl, altText: chartText }),
      Blocks.Section({ text: messages.join('\n') }),
    )
    .asUser()
    .buildToObject();

  try {
    const result = await client.chat.postMessage(theMessage as ChatPostMessageArguments);
  } catch (e: any) {
    console.error('error', e.data.response_metadata.message);
  }
}

async function getTopPointSenders({ message, context, client }) {
  const { topOrBottom, digits }: { topOrBottom: string; digits: number } = context.matches.groups;
  const teamId = context.teamId;
  const topOrBottomString = Helpers.capitalizeFirstLetter(topOrBottom);
  const methodName = `get${topOrBottomString}Sender`;
  const tops = await databaseService[methodName](teamId, digits);

  const messages: string[] = [];
  if (tops.length > 0) {
    for (let i = 0, end = tops.length - 1, asc = end >= 0; asc ? i <= end : i >= end; asc ? i++ : i--) {
      const pointStr = tops[i].totalPointsGiven > 1 ? 'points given' : 'point given';
      messages.push(`${i + 1}. ${Md.user(tops[i].slackId)} (${tops[i].totalPointsGiven} ${pointStr})`);
    }
  } else {
    messages.push('No scores to keep track of yet!');
  }

  const chartText = `${topOrBottomString} ${digits} Qrafty Point Senders(s)`;
  const graphSize = Math.min(tops.length, Math.min(digits, 20));
  const chartUrl = new ImageCharts()
    .cht('bvg')
    .chs('999x200')
    .chtt(chartText)
    .chxt('x,y')
    .chxl(`0:|${_.take(_.map(tops, 'name'), graphSize).join('|')}`)
    .chd(`a:${_.take(_.map(tops, 'totalPointsGiven'), graphSize).join(',')}`)
    .toURL();

  const theMessage = Message({ channel: message.channel, text: chartText })
    .blocks(
      Blocks.Header({ text: chartText }),
      Blocks.Image({ imageUrl: chartUrl, altText: chartText }),
      Blocks.Section({ text: messages.join('\n') }),
    )
    .asUser()
    .buildToObject();

  try {
    const result = await client.chat.postMessage(theMessage as ChatPostMessageArguments);
  } catch (e: any) {
    console.error('error', e.data.response_metadata.message);
  }
}
