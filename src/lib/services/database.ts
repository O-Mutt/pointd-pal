/* eslint-disable no-restricted-syntax */
import moment from 'moment';
import { Connection } from 'mongoose';

import { app } from '../../../app';
import { Helpers as H } from '../helpers';
import { BotToken, IBotToken } from '../models/botToken';
import { IScoreLog, ScoreLog } from '../models/scoreLog';
import { IUser, User } from '../models/user';
import { connectionFactory } from './connectionsFactory';
import { eventBus } from './eventBus';

export class DatabaseService {
  spamTimeLimit: number;
  spamMessage: string;

  constructor() {
    require('dotenv').config();
    const { spamMessage, spamTimeLimit } = H.getProcessVariables(process.env);
    this.spamMessage = spamMessage;
    this.spamTimeLimit = spamTimeLimit;
  }

  /*
   * user - the name of the user
   */
  async getAllUsers(teamId: string) {
    const search = { id: { $exists: true } };
    //Logger.debug('getting _all_ users');
    const dbUsers = await User(connectionFactory(teamId)).find(search).exec();
    return dbUsers;
  }


  async isSpam(teamId: string, to: IUser, from: IUser) {
    //Logger.debug('spam check');
    const now = moment();
    const fiveMinutesAgo = now.subtract(this.spamTimeLimit, 'minutes').toDate();
    // There is 1+ and that means we have spam
    const isSpam =
      (await ScoreLog(connectionFactory(teamId))
        .countDocuments({ to: to.slackId, from: from.slackId, date: { $gte: fiveMinutesAgo } })
        .exec()) !== 0;
    //Logger.debug('spam check result', previousScoreExists);
    return isSpam;
  }

  async getTopScores(teamId: string, amount: number) {
    const results = await User(connectionFactory(teamId)).find({}).sort({ score: -1, accountLevel: -1 }).limit(amount);

    //Logger.debug('Trying to find top scores');

    return results;
  }

  async getBottomScores(teamId: string, amount) {
    const results = await User(connectionFactory(teamId)).find({}).sort({ score: 1, accountLevel: -1 }).limit(amount);

    //Logger.debug('Trying to find bottom scores');

    return results;
  }

  async getTopTokens(teamId: string, amount) {
    const results = await User(connectionFactory(teamId))
      .find({
        accountLevel: { $gte: 2 },
      })
      .sort({ token: -1, score: -1 })
      .limit(amount);

    //Logger.debug('Trying to find top tokens');

    return results;
  }

  async getBottomTokens(teamId: string, amount) {
    const results = await User(connectionFactory(teamId))
      .find({
        accountLevel: { $gte: 2 },
      })
      .sort({ token: 1, score: 1 })
      .limit(amount);

    //Logger.debug('Trying to find bottom tokens');

    return results;
  }

  async getTopSender(teamId: string, amount) {
    const results = await User(connectionFactory(teamId))
      .find({ totalPointsGiven: { $exists: true } })
      .sort({ totalPointsGiven: -1, accountLevel: -1 })
      .limit(amount);

    //Logger.debug('Trying to find top sender');

    return results;
  }

  async getBottomSender(teamId: string, amount) {
    const results = await User(connectionFactory(teamId))
      .find({ totalPointsGiven: { $exists: true } })
      .sort({ totalPointsGiven: 1, accountLevel: -1 })
      .limit(amount);

    //Logger.debug('Trying to find bottom sender');

    return results;
  }

  async erase(toBeErased: IUser, reason?: string): Promise<void> {
    if (reason) {
      const reasonScore: number = toBeErased.reasons.get(reason) || 0;
      toBeErased.reasons.delete(reason);
      toBeErased.score = toBeErased.score - reasonScore;
      await toBeErased.save();
    } else {
      await toBeErased.delete();
    }
    return;
  }

  async updateAccountLevelToTwo(user: IUser): Promise<void> {
    user.pointdPalToken = user.score;
    user.accountLevel = 2;
    await user.save();
    await BotToken
      .findOneAndUpdate({}, { $inc: { pointdPalToken: -user.pointdPalToken } })
      .exec();
    eventBus.emit('plusplus-tokens');
    return;
  }

  async getTopSenderInDuration(connection: Connection, amount: number = 10, days: number = 7): Promise<any[]> {
    const topSendersForDuration = await ScoreLog(connection)
      .aggregate([
        {
          $lookup: {
            from: 'scores',
            localField: 'from',
            foreignField: 'slackId',
            as: 'user'
          }
        },
        {
          $unwind: '$user'
        },
        {
          $match: { date: { $gt: new Date(new Date().setDate(new Date().getDate() - days)) } },
        },
        {
          $project: {
            slackId: '$from',
            name: '$user.name',
            scoreChange: '$scoreChange'
          }
        },
        {
          $group: { _id: '$slackId', name: { $first: '$name' }, scoreChange: { $sum: '$scoreChange' } },
        },
        {
          $sort: { scoreChange: -1 },
        },
      ])
      .limit(amount)
      .exec();
    return topSendersForDuration;
  }

  async getTopReceiverInDuration(connection: Connection, amount: number = 10, days: number = 7): Promise<any[]> {
    const topRecipientForDuration = await ScoreLog(connection)
      .aggregate([
        {
          $lookup: {
            from: 'scores',
            localField: 'to',
            foreignField: 'slackId',
            as: 'user'
          }
        },
        {
          $unwind: '$user'
        },
        {
          $match: { date: { $gt: new Date(new Date().setDate(new Date().getDate() - days)) } },
        },
        {
          $project: {
            slackId: '$to',
            name: '$user.name',
            scoreChange: '$scoreChange'
          }
        },
        {
          $group: { _id: '$slackId', name: { $first: '$name' }, scoreChange: { $sum: '$scoreChange' } },
        },
        {
          $sort: { scoreChange: -1 },
        },
      ])
      .limit(amount)
      .exec();
    return topRecipientForDuration;
  }

  async getTopRoomInDuration(connection: Connection, amount: number = 3, days: number = 7): Promise<any[]> {
    const topRoomForDuration = await ScoreLog(connection)
      .aggregate([
        {
          $match: { date: { $gt: new Date(new Date().setDate(new Date().getDate() - days)) } },
        },
        {
          $group: { _id: '$channel', scoreChange: { $sum: '$scoreChange' } },
        },
        {
          $sort: { scoreChange: -1 },
        },
      ])
      .limit(amount)
      .exec();
    return topRoomForDuration;
  }

  /**
   *
   * @param {object} user the user receiving the points
   * @param {object} from the user sending the points
   * @param {number} scoreChange the increment in which the user is getting/losing points
   * @returns {object} the user who received the points updated value
   */
  async transferTokens(teamId: string, user: IUser, from: IUser, scoreChange: number): Promise<void> {
    user.pointdPalToken = user.pointdPalToken || 0 + scoreChange;
    from.pointdPalToken = from.pointdPalToken || 0 - scoreChange;
    await user.save();
    await from.save();
  }

  async getMagicSecretStringNumberValue() {
    const updateBotWallet = await BotToken.findOne({ name: 'pointdPal' });
    if (updateBotWallet) {
      return updateBotWallet.magicString;
    }
    return '';
  }
}
