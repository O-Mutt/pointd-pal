import { DatabaseService } from './database';
import { IUser, User } from '../models/user';
import { PPSpamEvent, PPSpamEventName } from '../types/Events';
import { eventBus } from './eventBus';
import { Md } from 'slack-block-builder';
import { connectionFactory } from './connectionsFactory';
import { BotToken } from '../models/botToken';
import { QraftyConfig } from '../models/qraftyConfig';
import { ChatPostMessageArguments, ChatPostMessageResponse } from '@slack/web-api';
import { app } from '../../../app';
import { Installation } from '../models/installation';
import { IScoreLog, ScoreLog } from '../models/scoreLog';
import { Helpers as H } from '../helpers';

export class ScoreKeeper {
  databaseService: DatabaseService;
  spamMessage: string;
  /*
  * params.spamMessage
  */
  constructor() {
    require('dotenv').config();
    const { spamMessage } = H.getProcessVariables(process.env);
    this.spamMessage = spamMessage;
    this.databaseService = new DatabaseService();
  }

  /*
  * Method to allow up or down vote of a user
  *
  * userName - the user who is receiving the score change
  * from - the user object that is sending the score change
  * reason - the reason for score change
  * incrementValue - [number] the value to change the score by
  * return scoreObject - the new document for the user who received the score
  */
  async incrementScore(teamId: string, toId: string, fromId: string, channel: string, incrementValue: number, reason?: string): Promise<{ toUser: IUser; fromUser: IUser; }> {
    try {
      const connection = connectionFactory(teamId);
      const toUser = await User(connection).findOneBySlackIdOrCreate(teamId, toId);
      const fromUser = await User(connection).findOneBySlackIdOrCreate(teamId, fromId);
      const bot = await BotToken.findOne({}).exec();
      const qraftyConfig = await QraftyConfig(connection).findOneOrCreate(teamId);
      const install = await Installation.findOne({ teamId: teamId });

      if (fromUser.isBot === true) {
        throw new Error('Bots can\'t send points, silly.');
      }

      if ((await this.isSpam(teamId, toUser, fromUser)) || this.isSendingToSelf(teamId, toUser, fromUser)) {
        throw new Error(`I'm sorry ${Md.user(fromUser.slackId)}, I'm afraid I can't do that.`);
      }
      toUser.score = toUser.score + incrementValue;
      if (reason) {
        const newReasonScore = (toUser.reasons.get(reason) || 0) + incrementValue;
        toUser.reasons.set(reason, newReasonScore);
      }

      //await this.databaseService.savePointsGiven(fromUser, toUser, incrementValue);
      const newScore: number = (fromUser.pointsGiven.get(toUser.slackId) || 0) + Math.abs(incrementValue);
      fromUser.pointsGiven.set(toUser.slackId, newScore);
      fromUser.totalPointsGiven = fromUser.totalPointsGiven + incrementValue;
      if (qraftyConfig.formalFeedbackUrl &&
        newScore % qraftyConfig.formalFeedbackModulo === 0 &&
        install?.installation.bot?.token) {
        await app.client.chat.postMessage({
          token: install.installation.bot.token,
          channel: fromUser.slackId,
          text: `Looks like you've given ${Md.user(toUser.slackId)} quite a few points, maybe should submit a formal praise ${Md.link(qraftyConfig.formalFeedbackUrl)}`,
        } as ChatPostMessageArguments);
      }

      try {
        const scoreLog: IScoreLog = {
          from: fromUser.slackId,
          to: toUser.slackId,
          date: new Date(),
          channel,
          reason,
          scoreChange: incrementValue,
        };
        await ScoreLog(connection).create(scoreLog);
      } catch (e) {
        console.error(`failed saving spam log for user ${toUser.name} from ${fromUser.name} in channel ${channel} because ${reason}`, e);
      }

      if (toUser && toUser.accountLevel > 1) {
        if (bot) {
          bot.token = bot.token - incrementValue;
        }
        toUser.qraftyToken = toUser.qraftyToken + incrementValue
        //saveResponse = await this.databaseService.transferScoreFromBotToUser(toUser, incrementValue, fromUser);
      }
      await toUser.save();
      await fromUser.save();
      await bot?.save();
      return { toUser, fromUser };
    } catch (e) {
      console.error(`failed to ${incrementValue > 0 ? 'add' : 'subtract'} point to [${toId}] from [${fromId}] because [${reason ? reason : 'no reason'}]`, e);
      throw e;
    }
  }

  async transferTokens(teamId: string, toId: string, fromId: string, channel: string, numberOfTokens: number, reason?: string): Promise<{ toUser: IUser; fromUser: IUser; }> {
    try {
      const connection = connectionFactory(teamId);
      const toUser = await User(connection).findOneBySlackIdOrCreate(teamId, toId);
      const fromUser = await User(connection).findOneBySlackIdOrCreate(teamId, fromId);
      if (toUser.accountLevel < 2 && fromUser.accountLevel < 2) {
        // to or from is not level 2
        throw new Error(`In order to send tokens to ${Md.user(toUser.slackId)} you both must be, at least, level 2.`);
      }

      if (fromUser.qraftyToken && fromUser.qraftyToken < numberOfTokens) {
        // from has too few tokens to send that many
        throw new Error(`You don't have enough tokens to send ${numberOfTokens} to ${Md.user(toUser.slackId)}`);
      }

      if ((await this.isSpam(teamId, toUser, fromUser)) || this.isSendingToSelf(teamId, toUser, fromUser)) {
        throw new Error(`I'm sorry ${Md.user(fromUser.slackId)}, I'm afraid I can't do that.`);
      }

      fromUser.qraftyToken = fromUser.qraftyToken || 0 - numberOfTokens;
      toUser.qraftyToken = toUser.qraftyToken || 0 + numberOfTokens;
      if (reason) {
        const newReasonScore = (toUser.reasons.get(reason) || 0) + numberOfTokens;
        toUser.reasons.set(reason, newReasonScore);
      }

      const newScore: number = (fromUser.pointsGiven.get(toUser.slackId) || 0) + Math.abs(numberOfTokens);
      fromUser.pointsGiven.set(toUser.slackId, newScore);
      fromUser.totalPointsGiven = fromUser.totalPointsGiven + numberOfTokens;
      try {
        await ScoreLog(connection).create({
          from: fromUser.slackId,
          to: toUser.slackId,
          date: new Date(),
          channel,
          reason,
          scoreChange: numberOfTokens,
        });
      } catch (e) {
        console.error(`failed saving spam log for user ${toUser.name} from ${fromUser.name} in channel ${channel} because ${reason ? reason : 'no reason'}`, e);
      }
      await toUser.save();
      await fromUser.save()
      return {
        toUser,
        fromUser,
      };
    } catch (e) {
      console.error(`failed to transfer tokens to [${toId}] from [${fromId}] because [${reason ? reason : 'no reason'}]`, e);
      throw e;
    }
  }

  async erase(teamId: string, toBeErased: IUser, admin: IUser, channel: string, reason?: string) {
    //Logger.error(`Erasing all scores for ${user} by ${from}`);
    await this.databaseService.erase(toBeErased, reason);

    return true;
  }

  async isSpam(teamId: string, recipient: IUser, sender: IUser) {
    const isSpam = await this.databaseService.isSpam(teamId, recipient, sender);
    if (isSpam) {
      const spamEvent: PPSpamEvent = {
        recipient,
        sender,
        notificationMessage: this.spamMessage,
        reason: `You recently sent ${Md.user(recipient.slackId)} a point.`,
        teamId,
      };

      eventBus.emit(PPSpamEventName, spamEvent);
    }
    return isSpam;
  }

  isSendingToSelf(teamId: string, recipient: IUser, sender: IUser) {
    //Logger.debug(`Checking if is to self. To [${to.name}] From [${from.name}], Valid: ${to.name !== from.name}`);
    const isToSelf = recipient.slackId === sender.slackId;
    if (isToSelf) {
      const spamEvent: PPSpamEvent = {
        recipient,
        sender,
        notificationMessage: this.spamMessage,
        reason: 'Looks like you may be trying to send a point to yourself.',
        teamId
      };
      eventBus.emit(PPSpamEventName, spamEvent);
    }
    return isToSelf;
  }
}
