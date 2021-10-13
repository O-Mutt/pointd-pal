/* eslint-disable no-restricted-syntax */
import moment, { Moment } from 'moment';
import EventEmitter from 'events';

import { app } from '../../../app';

import { Logger } from '@slack/logger';
import mongoose from 'mongoose';
import { User, IUser } from '../models/user';
import { ScoreLog } from '../models/scoreLog';
import { BotToken, IBotToken } from '../models/botToken';


export class DatabaseService {
  private eventEmitter: EventEmitter;
  private database: mongoose.Connection | undefined;
  uri: string;
  furtherFeedbackScore: number;
  peerFeedbackUrl: string;
  spamTimeLimit: number;
  spamMessage: string;

  constructor(params) {
    this.database = undefined;
    this.uri = params.mongoUri;
    this.furtherFeedbackScore = params.furtherFeedbackSuggestedScore;
    this.peerFeedbackUrl = params.peerFeedbackUrl;
    this.spamTimeLimit = params.spamTimeLimit;
    this.eventEmitter = new EventEmitter();
    this.spamMessage = params.spamMessage;
  }

  async connect() {
    if (this.database) {
      return;
    }
    await mongoose.connect(this.uri);
    this.database = mongoose.connection;
  }

  /*
  * user - the name of the user
  */
  async getUser(userId: string): Promise<IUser> {
    (await this.connect());

    // Maybe this should include a migration path to keep the user object up to date with any changes?
    const user = await User.findOneBySlackIdOrCreate(userId);
    return user;
  }

  /*
  * user - the name of the user
  */
  async getAllUsers() {
    const search = { id: { $exists: true } };
    //Logger.debug('getting _all_ users');
    (await this.connect());

    const dbUsers = await User.find(search).exec();
    return dbUsers;
  }

  async savePlusPlusLog(to: IUser, from: IUser, channel: string, reason: string | undefined, incrementValue: number) {
    (await this.connect());

    from.totalPointsGiven = from.totalPointsGiven + incrementValue;
    await from.save();
    await ScoreLog.create({ 
      from: from.slackId,
      to: to.slackId,
      date: new Date(),
      channel,
      reason,
      scoreChange: incrementValue
    });
  }

  async isSpam(to: IUser, from: IUser) {
    //Logger.debug('spam check');
    (await this.connect());

    const now = moment();
    const fiveMinutesAgo = now.subtract(this.spamTimeLimit, 'minutes').toDate();
    // There is 1+ and that means we have spam
    const isSpam = (await ScoreLog.countDocuments({ to: to.slackId, from: from.slackId, date: { $gte: fiveMinutesAgo }}).exec()) !== 0;
    //Logger.debug('spam check result', previousScoreExists);
    return isSpam
  }

  /*
  * from - database user who is sending the score
  * to - database user who is receiving the score
  * score - the number of score that is being sent
  */
  async savePointsGiven(from: IUser, to: IUser, score: number) {
    (await this.connect());


    const oldScore = from.pointsGiven[to.slackId] ? from.pointsGiven[to.slackId] : 0;
    // even if they are down voting them they should still get a tally (e.g. + 1) as they ++/-- the same person
    from.pointsGiven[to.slackId] = (oldScore + 1);
    await from.save();

    if (from.pointsGiven[to.slackId] % this.furtherFeedbackScore === 0) {
      //Logger.debug(`${from.name} has sent a lot of points to ${to.name} suggesting further feedback ${score}`);
      await app.client.chat.postMessage({
        channel: from.slackId,
        text: `Looks like you've given <@${to.slackId}> quite a few points, maybe you should look at submitting ${this.peerFeedbackUrl}`
      });
    }
  }

  async getTopScores(amount) {
    (await this.connect());

    const results = await User
      .find({})
      .sort({ score: -1, accountLevel: -1 })
      .limit(amount);

    //Logger.debug('Trying to find top scores');

    return results;
  }

  async getBottomScores(amount) {
    (await this.connect());

    const results = await User
      .find({})
      .sort({ score: 1, accountLevel: -1 })
      .limit(amount);

    //Logger.debug('Trying to find bottom scores');

    return results;
  }

  async getTopTokens(amount) {
    (await this.connect());

    const results = await User
      .find({
        accountLevel: { $gte: 2 },
      })
      .sort({ token: -1, score: -1 })
      .limit(amount);

    //Logger.debug('Trying to find top tokens');

    return results;
  }

  async getBottomTokens(amount) {
    (await this.connect());

    const results = await User
      .find({
        accountLevel: { $gte: 2 },
      })
      .sort({ token: 1, score: 1 })
      .limit(amount);

    //Logger.debug('Trying to find bottom tokens');

    return results;
  }

  async getTopSender(amount) {
    (await this.connect());

    const results = await User
      .find({ totalPointsGiven: { $exists: true } })
      .sort({ totalPointsGiven: -1, accountLevel: -1 })
      .limit(amount);

    //Logger.debug('Trying to find top sender');

    return results;
  }

  async getBottomSender(amount) {
    (await this.connect());

    const results = await User
      .find({ totalPointsGiven: { $exists: true } })
      .sort({ totalPointsGiven: 1, accountLevel: -1 })
      .limit(amount);

    //Logger.debug('Trying to find bottom sender');

    return results;
  }

  async erase(user: IUser, reason): Promise<void> {
    (await this.connect());

    if (reason) {
      const reasonScore: number = user.reasons[reason];
      delete user.reasons[reason];
      user.score = user.score - reasonScore;
      await user.save();
    } else {
      await user.remove();
    }
    return;
  }

  async updateAccountLevelToTwo(user: IUser): Promise<void> {
    (await this.connect());

    user.token = user.score;
    user.accountLevel = 2;
    await user.save();
    await BotToken.findOneAndUpdate({}, { $inc: { token: -user.token }}).exec();
    this.eventEmitter.emit('plusplus-tokens');
    return;
  }

  async getBotWallet(): Promise<IBotToken> {
    (await this.connect());

    const botWallet = await BotToken.findOne({ name: 'qrafty' }).exec();
    return botWallet as IBotToken;
  }

  async getTopSenderInDuration(amount = 10, days = 7) {
    (await this.connect());

    const topSendersForDuration = await ScoreLog.aggregate([
      {
        $match: { date: { $gt: new Date(new Date().setDate(new Date().getDate() - days)) } },
      },
      {
        $group: { _id: '$from', scoreChange: { $sum: '$scoreChange' } },
      },
      {
        $sort: { scoreChange: -1 },
      }])
      .limit(amount).exec();
    return topSendersForDuration;
  }

  async getTopReceiverInDuration(amount = 10, days = 7) {
    (await this.connect());

    const topRecipientForDuration = await ScoreLog.aggregate([
      {
        $match: { date: { $gt: new Date(new Date().setDate(new Date().getDate() - days)) } },
      },
      {
        $group: { _id: '$to', scoreChange: { $sum: '$scoreChange' } },
      },
      {
        $sort: { scoreChange: -1 },
      }])
      .limit(amount).exec();
    return topRecipientForDuration;
  }

  async getTopRoomInDuration(amount = 3, days = 7) {
    (await this.connect());

    const topRoomForDuration = await ScoreLog.aggregate([
      {
        $match: { date: { $gt: new Date(new Date().setDate(new Date().getDate() - days)) } },
      },
      {
        $group: { _id: '$channel', scoreChange: { $sum: '$scoreChange' } },
      },
      {
        $sort: { scoreChange: -1 },
      }])
      .limit(amount).exec();
    return topRoomForDuration;
  }

  /**
   *
   * @param {object} user the user receiving the points
   * @param {object} from the user sending the points
   * @param {number} scoreChange the increment in which the user is getting/losing points
   * @returns {object} the user who received the points updated value
   */
  async transferTokens(user: IUser, from: IUser, scoreChange: number, ): Promise<void> {
    (await this.connect());

    user.token = user.token || 0 + scoreChange;
    from.token = from.token || 0 - scoreChange;
    await user.save();
    await from.save();
  }

  async getMagicSecretStringNumberValue() {
    (await this.connect());

    const updateBotWallet = await BotToken.findOne({ name: 'qrafty' });
    if (updateBotWallet) {
      return updateBotWallet.magicString;
    }
    return '';
  }
}