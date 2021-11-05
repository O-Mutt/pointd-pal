import _ from 'lodash';
import moment from 'moment';
import ImageCharts from 'image-charts';

import { directMention } from '@slack/bolt';

import { app } from '../app';
import { Helpers as H } from './lib/helpers';
import { regExpCreator } from './lib/regexpCreator';
import { DatabaseService } from './lib/services/database';
import { Blocks, Md, Message } from 'slack-block-builder';
import { ChatPostMessageArguments } from '@slack/web-api';
import { ESMap } from 'typescript';
import { IUser, User } from './lib/models/user';
import { connectionFactory } from './lib/services/connectionsFactory';

const procVars = H.getProcessVariables(process.env);
const databaseService = new DatabaseService();

app.message(regExpCreator.createAskForScoreRegExp(), directMention(), respondWithScore);
app.message(regExpCreator.createTopBottomRegExp(), directMention(), respondWithLeaderLoserBoard);
app.message(regExpCreator.createTopBottomTokenRegExp(), directMention(), respondWithLeaderLoserTokenBoard);
app.message(regExpCreator.createTopPointGiversRegExp(), directMention(), getTopPointSenders);

async function respondWithScore({ message, context, logger, say }) {
  logger.debug('respond with the score');
  const { userId } = context.matches.groups;
  const teamId = context.teamId as string;
  const user: IUser = await User(connectionFactory(teamId)).findOneBySlackIdOrCreate(teamId, userId);

  let tokenString = '.';
  if (user.accountLevel > 1) {
    tokenString = ` (*${user.qraftyToken} Qrafty Token${H.getEsOnEndOfWord(user.qraftyToken)}*).`;
  }

  let baseString = `${Md.user(user.slackId)} has ${Md.bold(user.score.toString())} ${Md.bold('point' + H.getEsOnEndOfWord(user.score))}${tokenString}`;
  baseString += `\n${Md.italic('Account Level')}: ${user.accountLevel}`;
  baseString += `\n${Md.italic('Total Points Given')}: ${user.totalPointsGiven}`;
  if (user.robotDay) {
    const dateObj = new Date(user.robotDay);
    baseString += `\n:birthday: ${Md.bold('Qraftyday')} is ${Md.bold(moment(dateObj).format('MM-DD-yyyy'))}`;
  }

  let reasonsStr: string = '';
  const keys: string[] = [];
  user.reasons.forEach((points, key) => {
    keys.push(key);
  });
  logger.debug("all the keys!", user.reasons.keys(), keys);
  if (keys.length > 0) {
    let sampleReasons: ESMap<string, number> = new Map();
    const maxReasons = keys.length >= 5 ? 5 : keys.length;
    do {
      const randomNumber = _.random(0, keys.length - 1);
      const reason = keys[randomNumber];
      const value = user.reasons.get(reason) as number;
      sampleReasons.set(H.decode(reason) || '', value);
      logger.debug('loop the reasons!', reason, value);
    } while (sampleReasons.size < maxReasons);

    const reasonMessageArray: string[] = [];
    sampleReasons.forEach((points, reason) => {
      const pointStr = points > 1 ? 'points' : 'point';
      reasonMessageArray.push(`_${reason}_: ${points} ${pointStr}`);
    });

    reasonsStr = `\n\n:star: Here are some reasons :star:\n${reasonMessageArray.join('\n')}`;
  }

  const sayArgs = H.getSayMessageArgs(message, `${baseString}${reasonsStr}`);
  const sayResponse = await say(sayArgs);
}

async function respondWithLeaderLoserBoard({ client, message, context, logger, say }) {
  const { topOrBottom, digits }: { topOrBottom: string; digits: number } = context.matches.groups;
  const teamId = context.teamId as string;
  const topOrBottomString = H.capitalizeFirstLetter(topOrBottom);
  const methodName = `get${topOrBottomString}Scores`;
  const tops = await databaseService[methodName](teamId, digits);

  const messages: string[] = [];
  if (tops.length > 0) {
    for (let i = 0, end = tops.length - 1, asc = end >= 0; asc ? i <= end : i >= end; asc ? i++ : i--) {
      if (tops[i].accountLevel && tops[i].accountLevel > 1) {
        const tokenStr = tops[i].qraftyToken > 1 ? 'Tokens' : 'Token';
        messages.push(
          `${i + 1}. ${Md.user(tops[i].slackId)}: ${tops[i].score} (*${tops[i].qraftyToken} ${H.capitalizeFirstLetter(
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
    .asUser();

  try {
    const result = await client.chat.postMessage(theMessage.buildToObject() as ChatPostMessageArguments);
  } catch (e: any) {
    console.error('error', e, theMessage.printPreviewUrl());
  }
}

async function respondWithLeaderLoserTokenBoard({ message, context, client }) {
  const { topOrBottom, digits }: { topOrBottom: string; digits: number } = context.matches.groups;
  const teamId = context.teamId as string;
  const topOrBottomString = H.capitalizeFirstLetter(topOrBottom);
  const methodName = `get${topOrBottomString}Tokens`;
  const tops = await databaseService[methodName](teamId, digits);

  const messages: string[] = [];
  if (tops.length > 0) {
    for (let i = 0, end = tops.length - 1, asc = end >= 0; asc ? i <= end : i >= end; asc ? i++ : i--) {
      const tokenStr = tops[i].qraftyToken > 1 ? 'Tokens' : 'Token';
      const pointStr = tops[i].score > 1 ? 'points' : 'point';
      messages.push(
        `${i + 1}. ${Md.user(tops[i].slackId)}: *${tops[i].qraftyToken} Qrafty ${tokenStr}* (${tops[i].score
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
    .chd(`a:${_.take(_.map(tops, 'qraftyToken'), graphSize).join(',')}`)
    .toURL();

  const theMessage = Message({ channel: message.channel, text: chartText })
    .blocks(
      Blocks.Header({ text: chartText }),
      Blocks.Image({ imageUrl: chartUrl, altText: chartText }),
      Blocks.Section({ text: messages.join('\n') }),
    )
    .asUser();

  try {
    const result = await client.chat.postMessage(theMessage.buildToObject() as ChatPostMessageArguments);
  } catch (e: any) {
    console.error('error', e, theMessage.printPreviewUrl());
  }
}

async function getTopPointSenders({ message, context, client }) {
  const { topOrBottom, digits }: { topOrBottom: string; digits: number } = context.matches.groups;
  const teamId = context.teamId as string;
  const topOrBottomString = H.capitalizeFirstLetter(topOrBottom);
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
    .asUser();

  try {
    const result = await client.chat.postMessage(theMessage.buildToObject() as ChatPostMessageArguments);
  } catch (e: any) {
    console.error('error', e, theMessage.printPreviewUrl());
  }
}
