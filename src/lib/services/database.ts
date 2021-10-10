/* eslint-disable no-restricted-syntax */
import { Db, MongoClient } from 'mongodb';
import moment, { Moment } from 'moment';
import EventEmitter from 'events';

import { app } from '../../../app';

import { scoresDocumentName, createNewLevelOneUser, User } from '../data/scores';
import { logDocumentName } from '../data/scoreLog';
import { botTokenDocumentName } from '../data/botToken';
import { Logger } from '@slack/logger';


export class DatabaseService {
  private eventEmitter: EventEmitter;
  private db: Db | undefined;
  uri: string;
  furtherFeedbackScore: number;
  peerFeedbackUrl: string;
  spamTimeLimit: number;
  spamMessage: string;

  constructor(params) {
    this.db = undefined;
    this.uri = params.mongoUri;
    this.furtherFeedbackScore = params.furtherFeedbackSuggestedScore;
    this.peerFeedbackUrl = params.peerFeedbackUrl;
    this.spamTimeLimit = params.spamTimeLimit;
    this.eventEmitter = new EventEmitter();
    this.spamMessage = params.spamMessage;
  }

  async init() {
    const client = new MongoClient(this.uri);
    const connection = await client.connect();
    this.db = connection.db();
  }

  async getDb(): Promise<Db | undefined> {
    if (!this.db) {
      await this.init();
    }
    return this.db;
  }

  /*
  * user - the name of the user
  */
  async getUser(userId: string, logger: any | undefined = undefined): Promise<User> {
    const db = (await this.getDb()) as Db;

    logger.debug('get the db', db);
    // Maybe this should include a migration path to keep the user object up to date with any changes?
    const user = await db.collection(scoresDocumentName).findOne(
      { id: userId },
      { sort: { score: -1 } },
    );
    logger.debug('did i find the user?', user, userId);


    if (!user) {
      logger.debug('creating a new user', userId);
      const newUser = await createNewLevelOneUser(userId, logger);
      return newUser;
    }
    return user as User;
  }

  /*
  * user - the name of the user
  */
  async getAllUsers() {
    const search = { id: { $exists: true } };
    //Logger.debug('getting _all_ users');
    const db = (await this.getDb()) as Db;

    const dbUsers = await db.collection(scoresDocumentName).find(search).toArray();
    return dbUsers;
  }

  /**
   * Saves the user with a new score
   * @param {object} user the user who is getting a point change
   * @returns {object} the updated user who received a change
   */
  async saveUser(user: User): Promise<User> {
    const db = (await this.getDb()) as Db;

    const result = await db.collection(scoresDocumentName)
      .findOneAndUpdate(
        { id: user.id },
        {
          $set: user,
        },
        {
          returnDocument: 'after',
          upsert: true,
          sort: { score: -1 },
        },
      );

    const updatedUser = result.value;

    //Logger.debug(`Saving user original: [${user.name}: ${user.score}], new [${updatedUser.name}: ${updatedUser.score}]`);

    return updatedUser as User;
  }

  async savePlusPlusLog(to, from, channel, reason, incrementValue) {
    const pointsAmount = parseInt(incrementValue, 10);
    const fromId = from.id || from.name;
    const scoreSearch = from.id ? { slackId: from.id } : { name: from.name };
    const toId = to.id || to.name;
    const db = (await this.getDb()) as Db;
    await db.collection(scoresDocumentName).updateOne(scoreSearch, { $inc: { totalPointsGiven: pointsAmount } });
    await db.collection(logDocumentName).insertOne({
      from: fromId,
      to: toId,
      date: moment().toISOString(),
      channel,
      reason,
      scoreChange: pointsAmount,
    });
  }

  async isSpam(toId, fromId) {
    //Logger.debug('spam check');
    const db = (await this.getDb()) as Db;
    const now: Moment = moment();
    const fiveMinutesAgo = now.subtract(this.spamTimeLimit, 'minutes').toISOString();
    const previousScoreExists = await db.collection(logDocumentName)
      .countDocuments({
        fromId,
        toId,
        date: { $gte: fiveMinutesAgo },
      });
    //Logger.debug('spam check result', previousScoreExists);
    if (previousScoreExists !== 0) {
      this.eventEmitter.emit('plus-plus-spam', {
        toId,
        fromId,
        message: this.spamMessage,
        reason: `You recently sent <@${toId}> a point.`,
      });
      return true;
    }

    return false;
  }

  /*
  * from - database user who is sending the score
  * to - database user who is receiving the score
  * score - the number of score that is being sent
  */
  async savePointsGiven(from: User, to: User, score: number) {
    const db = (await this.getDb()) as Db;

    const oldScore = from.pointsGiven[to.id] ? from.pointsGiven[to.id] : 0;
    // even if they are down voting them they should still get a tally as they ++/-- the same person
    from.pointsGiven[to.id] = (oldScore + 1);
    const result = await db.collection(scoresDocumentName)
      .findOneAndUpdate(
        { id: from.id },
        { $set: from },
        {
          returnDocument: 'after',
          upsert: true,
          sort: { score: -1 },
        },
      );
    const updatedUser = result.value;

    if (updatedUser && updatedUser.pointsGiven[to.id] % this.furtherFeedbackScore === 0) {
      //Logger.debug(`${from.name} has sent a lot of points to ${to.name} suggesting further feedback ${score}`);
      await app.client.chat.postMessage({ 
        channel: from.id,
        text: `Looks like you've given <@${to.id}> quite a few points, maybe you should look at submitting ${this.peerFeedbackUrl}` 
      });
    }
  }

  async getTopScores(amount) {
    const db = (await this.getDb()) as Db;
    const results = await db.collection(scoresDocumentName)
      .find({})
      .sort({ score: -1, accountLevel: -1 })
      .limit(amount)
      .toArray();

    //Logger.debug('Trying to find top scores');

    return results;
  }

  async getBottomScores(amount) {
    const db = (await this.getDb()) as Db;
    const results = await db.collection(scoresDocumentName)
      .find({})
      .sort({ score: 1, accountLevel: -1 })
      .limit(amount)
      .toArray();

    //Logger.debug('Trying to find bottom scores');

    return results;
  }

  async getTopTokens(amount) {
    const db = (await this.getDb()) as Db;
    const results = await db.collection(scoresDocumentName)
      .find({
        accountLevel: { $gte: 2 },
      })
      .sort({ token: -1, score: -1 })
      .limit(amount)
      .toArray();

    //Logger.debug('Trying to find top tokens');

    return results;
  }

  async getBottomTokens(amount) {
    const db = (await this.getDb()) as Db;
    const results = await db.collection(scoresDocumentName)
      .find({
        accountLevel: { $gte: 2 },
      })
      .sort({ token: 1, score: 1 })
      .limit(amount)
      .toArray();

    //Logger.debug('Trying to find bottom tokens');

    return results;
  }

  async getTopSender(amount) {
    const db = (await this.getDb()) as Db;
    const results = await db.collection(scoresDocumentName)
      .find({ totalPointsGiven: { $exists: true } })
      .sort({ totalPointsGiven: -1, accountLevel: -1 })
      .limit(amount)
      .toArray();

    //Logger.debug('Trying to find top sender');

    return results;
  }

  async getBottomSender(amount) {
    const db = (await this.getDb()) as Db;
    const results = await db.collection(scoresDocumentName)
      .find({ totalPointsGiven: { $exists: true } })
      .sort({ totalPointsGiven: 1, accountLevel: -1 })
      .limit(amount)
      .toArray();

    //Logger.debug('Trying to find bottom sender');

    return results;
  }

  async erase(user, reason) {
    const userName = user.name ? user.name : user;
    const search = user.id ? { slackId: user.id } : { name: userName };
    const db = (await this.getDb()) as Db;

    let result;
    if (reason) {
      const oldUser = await db.collection(scoresDocumentName).findOne(search);
      if (oldUser) {
        const newScore = oldUser.score - oldUser.reasons[reason];
        result = await db.collection(scoresDocumentName)
          .updateOne(search, { $set: { score: newScore, reasons: { [`${reason}`]: 0 } } });
      }
    } else {
      /* result = await db.collection(scoresDocumentName)
        .deleteOne(search, { $set: { score: 0 } }); */
    }

    return result;
  }

  async updateAccountLevelToTwo(user) {
    const userName = user.name ? user.name : user;
    const search = user.id ? { slackId: user.id } : { name: userName };
    const db = (await this.getDb()) as Db;
    let tokensAdded = 0;
    const foundUser = await db.collection(scoresDocumentName).findOne(search);
    if (foundUser) {
      // we are leveling up from 0 (which is level 1) -> 2 or 2 -> 3
      if (foundUser.accountLevel && foundUser.accountLevel === 2) {
        // this is a weird case and shouldn't really happen... not sure about this...
        //Logger.debug(`Somehow FoundUser[${foundUser.name}] SearchedUser[${user.name}] was trying to upgrade their account to level 2.`);
        return true;
      }
      foundUser.accountLevel = 2;
      foundUser.token = 0;
      tokensAdded = foundUser.score;
      await db.collection(scoresDocumentName).updateOne(search, { $set: foundUser });
      const newScore = await this.transferScoreFromBotToUser(user, tokensAdded, undefined);
      return newScore;
    }
  }

  async getBotWallet() {
    const db = (await this.getDb()) as Db;
    const botWallet = await db.collection(botTokenDocumentName).findOne({ name: 'qrafty' });
    return botWallet;
  }

  async getTopSenderInDuration(amount = 10, days = 7) {
    const db = (await this.getDb()) as Db;
    const topSendersForDuration = await db.collection(logDocumentName).aggregate([
      {
        $match: { date: { $gt: new Date(new Date().setDate(new Date().getDate() - days)).toISOString() } },
      },
      {
        $group: { _id: '$from', scoreChange: { $sum: '$scoreChange' } },
      },
      {
        $sort: { scoreChange: -1 },
      }])
      .limit(amount).toArray();
    return topSendersForDuration;
  }

  async getTopReceiverInDuration(amount = 10, days = 7) {
    const db = (await this.getDb()) as Db;
    const topRecipientForDuration = await db.collection(logDocumentName).aggregate([
      {
        $match: { date: { $gt: new Date(new Date().setDate(new Date().getDate() - days)).toISOString() } },
      },
      {
        $group: { _id: '$to', scoreChange: { $sum: '$scoreChange' } },
      },
      {
        $sort: { scoreChange: -1 },
      }])
      .limit(amount).toArray();
    return topRecipientForDuration;
  }

  async getTopRoomInDuration(amount = 3, days = 7) {
    const db = (await this.getDb()) as Db;
    const topRoomForDuration = await db.collection(logDocumentName).aggregate([
      {
        $match: { date: { $gt: new Date(new Date().setDate(new Date().getDate() - days)).toISOString() } },
      },
      {
        $group: { _id: '$channel', scoreChange: { $sum: '$scoreChange' } },
      },
      {
        $sort: { scoreChange: -1 },
      }])
      .limit(amount).toArray();
    return topRoomForDuration;
  }

  /**
   *
   * @param {string} userName the name of the user receiving the points
   * @param {number} scoreChange the increment in which the user is getting/losing points
   * @param {string} fromName the name of the user sending the points
   * @returns {object} the user who received the points updated value
   */
  async transferScoreFromBotToUser(user: User, scoreChange: number, from: User | undefined): Promise<User> {
    const userName = user.name ? user.name : user;
    const search = user.id ? { slackId: user.id } : { name: userName };

    const db = (await this.getDb()) as Db;
    //Logger.info(`We are transferring ${scoreChange} ${Helpers.capitalizeFirstLetter('qrafty')} Tokens to ${userName} from ${from ? from.name : Helpers.capitalizeFirstLetter('qrafty')}`);
    const result = await db.collection(scoresDocumentName).findOneAndUpdate(
      search,
      {
        $inc:
        {
          token: scoreChange,
        },
      },
      {
        returnDocument: 'after',
      },
    );
    await db.collection(botTokenDocumentName).updateOne({ name: 'qrafty' }, { $inc: { token: -scoreChange } });
    // If this isn't a level up and the score is larger than 1 (tipping aka level 3)
    if (from && (scoreChange > 1 || scoreChange < -1)) {
      await db.collection(scoresDocumentName).updateOne({ id: from.id }, { $inc: { token: -scoreChange } });
    }
    return result.value as User;
  }

  async getMagicSecretStringNumberValue() {
    const db = (await this.getDb()) as Db;
    const updateBotWallet = await db.collection(botTokenDocumentName).findOne({ name: 'qrafty' });
    if (updateBotWallet) {
      return updateBotWallet.magicString;
    }
    return '';
  }

  async isAdmin(user: string) {
    const db = (await this.getDb()) as Db;
    return false;
  }
}