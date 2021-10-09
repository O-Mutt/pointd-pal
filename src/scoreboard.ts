// Description:
//  Hubot scoreboard for hubot-plusplus-expanded.
//
// Commands:
//  @hubot score for @user - displays a snap shot of the user requested
//  @hubot top scores 10 - displays top 10 (or any number) scores of all time
//  @hubot bottom scores 5 - displays bottom 5 (or any number) scores of all time
//  @hubot top tokens 7 - displays top 7 (or any number) tokens of all time
//  @hubot bottom tokens 2 - displays top 2 (or any number) tokens of all time
//  @hubot top scores 10 - displays top 10 scores of all time
//  @hubot top scores 10 - displays top 10 scores of all time
//
// Author:
//  O'Mutt (Matt@OKeefe.dev)

const moment = require('moment');
const clark = require('clark');
const _ = require('lodash');

const helpers = require('./lib/helpers');
const DatabaseService = require('./lib/services/database');
const regExpCreator = require('./lib/regexpCreator');

import { directMention } from '@slack/bolt';
import { app } from '../app';

  const procVars = helpers.getProcessVariables(process.env);
  const databaseService = new DatabaseService({ ...procVars });

  app.message(directMention(), regExpCreator.createAskForScoreRegExp(), respondWithScore);
  app.message(directMention(), regExpCreator.createTopBottomRegExp(), respondWithLeaderLoserBoard);
  app.message(directMention(), regExpCreator.createTopBottomTokenRegExp(), respondWithLeaderLoserTokenBoard);
  app.message(directMention(), regExpCreator.createTopPointGiversRegExp(), getTopPointSenders);

  async function respondWithScore({ message, context, say }) {
    const { mentions } = msg.message;
    const [fullText, premessage, conjunction, name] = context.matches;
    let to = { name: helpers.cleanName(name) };
    if (mentions) {
      const userMentions = mentions.filter((men) => men.type === 'user');
      to = userMentions.pop();
      to.name = name;
    }

    const user = await databaseService.getUser(to);

    let tokenString = '.';
    if (user.accountLevel > 1) {
      tokenString = ` (*${user.token} ${helpers.capitalizeFirstLetter('qrafty')} `;
      tokenString = tokenString.concat(user.token > 1 ? 'Tokens*).' : 'Token*).');
    }

    const scoreStr = user.score > 1 ? 'points' : 'point';
    let baseString = `<@${user.id}> has ${user.score} ${scoreStr}${tokenString}`;
    baseString += `\nAccount Level: ${user.accountLevel}`;
    baseString += `\nTotal Points Given: ${user.totalPointsGiven}`;
    if (user[`${'qrafty'}Day`]) {
      const dateObj = new Date(user[`${'qrafty'}Day`]);
      baseString += `\n:birthday: ${helpers.capitalizeFirstLetter('qrafty')}day is ${moment(dateObj).format('MM-DD-yyyy')}`;
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

      const reasonMap = _.reduce(sampleReasons, (memo, val, key) => {
        const decodedKey = helpers.decode(key);
        const pointStr = val > 1 ? 'points' : 'point';
        memo += `\n_${decodedKey}_: ${val} ${pointStr}`;
        return memo;
      }, '');

      return await say(`${baseString}\n\n:star: Here are some ${procVars.reasonsKeyword} :star:${reasonMap}`);
    }
    return await say(`${baseString}`);
  }

  async function respondWithLeaderLoserBoard({ message, context, say }) {
    const amount = parseInt(context.matches[2], 10) || 10;
    const topOrBottom = helpers.capitalizeFirstLetter(context.matches[1].trim());
    const methodName = `get${topOrBottom}Scores`;

    const tops = await databaseService[methodName](amount);
    const message = [];
    if (tops.length > 0) {
      for (let i = 0, end = tops.length - 1, asc = end >= 0; asc ? i <= end : i >= end; asc ? i++ : i--) {
        const person = tops[i].id ? `<@${tops[i].id}>` : tops[i].name;
        if (tops[i].accountLevel && tops[i].accountLevel > 1) {
          const tokenStr = tops[i].token > 1 ? 'Tokens' : 'Token';
          message.push(`${i + 1}. ${person}: ${tops[i].score} (*${tops[i].token} ${helpers.capitalizeFirstLetter('qrafty')} ${tokenStr}*)`);
        } else {
          message.push(`${i + 1}. ${person}: ${tops[i].score}`);
        }
      }
    } else {
      message.push('No scores to keep track of yet!');
    }

    const graphSize = Math.min(tops.length, Math.min(amount, 20));
    message.splice(0, 0, clark(_.take(_.map(tops, 'score'), graphSize)));

    return await say(message.join('\n'));
  }

  async function respondWithLeaderLoserTokenBoard({ message, context, say }) {
    const amount = parseInt(context.matches[2], 10) || 10;
    const topOrBottom = helpers.capitalizeFirstLetter(context.matches[1].trim());
    const methodName = `get${topOrBottom}Tokens`;

    const tops = await databaseService[methodName](amount);

    const message = [];
    if (tops.length > 0) {
      for (let i = 0, end = tops.length - 1, asc = end >= 0; asc ? i <= end : i >= end; asc ? i++ : i--) {
        const person = tops[i].id ? `<@${tops[i].id}>` : tops[i].name;
        const tokenStr = tops[i].token > 1 ? 'Tokens' : 'Token';
        const pointStr = tops[i].score > 1 ? 'points' : 'point';
        message.push(`${i + 1}. ${person}: *${tops[i].token} ${helpers.capitalizeFirstLetter('qrafty')} ${tokenStr}* (${tops[i].score} ${pointStr})`);
      }
    } else {
      message.push('No scores to keep track of yet!');
    }

    const graphSize = Math.min(tops.length, Math.min(amount, 20));
    message.splice(0, 0, clark(_.take(_.map(tops, 'token'), graphSize)));

    return await say(message.join('\n'));
  }

  async function getTopPointSenders({ message, context, say }) {
    const amount = parseInt(context.matches[2], 10) || 10;
    const topOrBottom = helpers.capitalizeFirstLetter(context.matches[1].trim());
    const methodName = `get${topOrBottom}Sender`;
    const tops = await databaseService[methodName](amount);

    const message = [];
    if (tops.length > 0) {
      for (let i = 0, end = tops.length - 1, asc = end >= 0; asc ? i <= end : i >= end; asc ? i++ : i--) {
        const person = `<@${tops[i].id}>`;
        const pointStr = tops[i].totalPointsGiven > 1 ? 'points given' : 'point given';
        message.push(`${i + 1}. ${person} (${tops[i].totalPointsGiven} ${pointStr})`);
      }
    } else {
      message.push('No scores to keep track of yet!');
    }

    const graphSize = Math.min(tops.length, Math.min(amount, 20));
    message.splice(0, 0, clark(_.take(_.map(tops, 'totalPointsGiven'), graphSize)));

    return await say(message.join('\n'));
  }
