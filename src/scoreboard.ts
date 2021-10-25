import clark from 'clark';
import _ from 'lodash';
import moment from 'moment';

import { directMention } from '@slack/bolt';

import { app } from '../app';
import { Helpers } from './lib/helpers';
import { regExpCreator } from './lib/regexpCreator';
import { DatabaseService } from './lib/services/database';

const procVars = Helpers.getProcessVariables(process.env);
const databaseService = new DatabaseService({ ...procVars });

// all of these: directMention()
app.message(regExpCreator.createAskForScoreRegExp(), respondWithScore);
app.message(regExpCreator.createTopBottomRegExp(), respondWithLeaderLoserBoard);
app.message(regExpCreator.createTopBottomTokenRegExp(), respondWithLeaderLoserTokenBoard);
app.message(regExpCreator.createTopPointGiversRegExp(), getTopPointSenders);

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
  let baseString = `<@${user.slackId}> has ${user.score} ${scoreStr}${tokenString}`;
  baseString += `\nAccount Level: ${user.accountLevel}`;
  baseString += `\nTotal Points Given: ${user.totalPointsGiven}`;
  if (user[`${'qrafty'}Day`]) {
    const dateObj = new Date(user[`${'qrafty'}Day`]);
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
      const value = user.reasons[keys[randomNumber]];
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

async function respondWithLeaderLoserBoard({ message, context, say }) {
  const { topOrBottom, digits }: { topOrBottom: string; digits: number } = context.matches.groups;
  const topOrBottomString = Helpers.capitalizeFirstLetter(topOrBottom);
  const methodName = `get${topOrBottomString}Scores`;
  const tops = await databaseService[methodName](digits);

  const messages: string[] = [];
  if (tops.length > 0) {
    for (let i = 0, end = tops.length - 1, asc = end >= 0; asc ? i <= end : i >= end; asc ? i++ : i--) {
      const person = tops[i].slackId ? `<@${tops[i].slackId}>` : tops[i].name;
      if (tops[i].accountLevel && tops[i].accountLevel > 1) {
        const tokenStr = tops[i].token > 1 ? 'Tokens' : 'Token';
        messages.push(
          `${i + 1}. ${person}: ${tops[i].score} (*${tops[i].token} ${Helpers.capitalizeFirstLetter(
            'qrafty',
          )} ${tokenStr}*)`,
        );
      } else {
        messages.push(`${i + 1}. ${person}: ${tops[i].score}`);
      }
    }
  } else {
    messages.push('No scores to keep track of yet!');
  }

  const graphSize = Math.min(tops.length, Math.min(digits, 20));
  messages.splice(0, 0, clark(_.take(_.map(tops, 'score'), graphSize)));

  return await say(messages.join('\n'));
}

async function respondWithLeaderLoserTokenBoard({ message, context, say }) {
  const { topOrBottom, digits }: { topOrBottom: string; digits: number } = context.matches.groups;
  const topOrBottomString = Helpers.capitalizeFirstLetter(topOrBottom);
  const methodName = `get${topOrBottomString}Tokens`;
  const tops = await databaseService[methodName](digits);

  const messages: string[] = [];
  if (tops.length > 0) {
    for (let i = 0, end = tops.length - 1, asc = end >= 0; asc ? i <= end : i >= end; asc ? i++ : i--) {
      const person = tops[i].slackId ? `<@${tops[i].slackId}>` : tops[i].name;
      const tokenStr = tops[i].token > 1 ? 'Tokens' : 'Token';
      const pointStr = tops[i].score > 1 ? 'points' : 'point';
      messages.push(
        `${i + 1}. ${person}: *${tops[i].token} ${Helpers.capitalizeFirstLetter('qrafty')} ${tokenStr}* (${tops[i].score
        } ${pointStr})`,
      );
    }
  } else {
    messages.push('No scores to keep track of yet!');
  }

  const graphSize = Math.min(tops.length, Math.min(digits, 20));
  messages.splice(0, 0, clark(_.take(_.map(tops, 'token'), graphSize)));

  return await say(messages.join('\n'));
}

async function getTopPointSenders({ message, context, say }) {
  const { topOrBottom, digits }: { topOrBottom: string; digits: number } = context.matches.groups;
  const topOrBottomString = Helpers.capitalizeFirstLetter(topOrBottom);
  const methodName = `get${topOrBottomString}Sender`;
  const tops = await databaseService[methodName](digits);

  const messages: string[] = [];
  if (tops.length > 0) {
    for (let i = 0, end = tops.length - 1, asc = end >= 0; asc ? i <= end : i >= end; asc ? i++ : i--) {
      const person = `<@${tops[i].slackId}>`;
      const pointStr = tops[i].totalPointsGiven > 1 ? 'points given' : 'point given';
      messages.push(`${i + 1}. ${person} (${tops[i].totalPointsGiven} ${pointStr})`);
    }
  } else {
    messages.push('No scores to keep track of yet!');
  }

  const graphSize = Math.min(tops.length, Math.min(digits, 20));
  messages.splice(0, 0, clark(_.take(_.map(tops, 'totalPointsGiven'), graphSize)));

  return await say(messages.join('\n'));
}
