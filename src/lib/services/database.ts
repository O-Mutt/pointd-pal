/* eslint-disable no-restricted-syntax */
import { Db, MongoClient } from 'mongodb';
import moment, { Moment } from 'moment';

import { scoresDocumentName, createNewLevelOneUser } from '../data/scores';

import { logDocumentName } from '../data/scoreLog';
import { Helpers } from '../helpers';
import { botTokenDocumentName } from '../data/botToken';

export class DatabaseService {
  private db: Db | undefined;
  uri: string;
  furtherFeedbackScore: number;
  peerFeedbackUrl: string;
  spamTimeLimit: number;
  constructor(params) {
    this.db = undefined;
    this.uri = params.mongoUri;
    this.furtherFeedbackScore = params.furtherFeedbackSuggestedScore;
    this.peerFeedbackUrl = params.peerFeedbackUrl;
    this.spamTimeLimit = params.spamTimeLimit;
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
  async getUser(user) {
    const userName = user.name ? user.name : user;
    const search = user.id ? { slackId: user.id } : { name: userName };
    //Logger.debug(`trying to find user ${JSON.stringify(search)}`);
    const db = (await this.getDb()) as Db;

    const dbUser = await db.collection(scoresDocumentName).findOne(
      search,
      { sort: { score: -1 } },
    );

    if (!dbUser) {
      //Logger.debug('creating a new user', user);
      const newUser = await createNewLevelOneUser(user);
      return newUser;
    }
    return dbUser;
  }

  /*
  * user - the name of the user
  */
  async getAllUsers() {
    const search = { slackId: { $exists: true } };
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
  async saveUser(user) {
    const userName = user.name ? user.name : user;
    const search = user.slackId ? { slackId: user.slackId } : { name: userName };
    const db = (await this.getDb()) as Db;

    const result = await db.collection(scoresDocumentName)
      .findOneAndUpdate(
        search,
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

    return updatedUser;
  }

  async savePlusPlusLog(to, from, channel, reason, incrementValue) {
    const pointsAmount = parseInt(incrementValue, 10);
    const fromId = from.slackId || from.name;
    const scoreSearch = from.slackId ? { slackId: from.slackId } : { name: from.name };
    const toId = to.slackId || to.name;
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

  async isSpam(to, from) {
    //Logger.debug('spam check');
    const db = (await this.getDb()) as Db;
    const now: Moment = moment();
    const fiveMinutesAgo = now.subtract(this.spamTimeLimit, 'minutes').toISOString();
    const previousScoreExists = await db.collection(logDocumentName)
      .countDocuments({
        from,
        to,
        date: { $gte: fiveMinutesAgo },
      });
    //Logger.debug('spam check result', previousScoreExists);
    if (previousScoreExists !== 0) {
      //Logger.error(`${from} is spamming points to ${to}! STOP THEM!!!!`);
      return true;
    }

    return false;
  }

  /*
  * from - database user who is sending the score
  * to - database user who is receiving the score
  * score - the number of score that is being sent
  */
  async savePointsGiven(from, to, score) {
    const db = (await this.getDb()) as Db;
    const cleanName = Helpers.cleanAndEncode(to.name);
    const fromUser = await this.getUser(from);
    const fromSearch = fromUser.slackId ? { slackId: fromUser.slackId } : { name: fromUser.name };

    const oldScore = fromUser.pointsGiven[cleanName] ? fromUser.pointsGiven[cleanName] : 0;
    // even if they are down voting them they should still get a tally as they ++/-- the same person
    fromUser.pointsGiven[cleanName] = (oldScore + 1);
    const result = await db.collection(scoresDocumentName)
      .findOneAndUpdate(
        fromSearch,
        { $set: fromUser },
        {
          returnDocument: 'after',
          upsert: true,
          sort: { score: -1 },
        },
      );
    const updatedUser = result.value;

    if (updatedUser && updatedUser.pointsGiven[cleanName] % this.furtherFeedbackScore === 0) {
      //Logger.debug(`${from.name} has sent a lot of points to ${to.name} suggesting further feedback ${score}`);
      const toIdent = to.slackId ? `<@${to.slackId}>` : to.name;
      //this.robot.messageRoom(from.id, `Looks like you've given ${toIdent} quite a few points, maybe you should look at submitting ${this.peerFeedbackUrl}`);
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
    const search = user.slackId ? { slackId: user.slackId } : { name: userName };
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
    const search = user.slackId ? { slackId: user.slackId } : { name: userName };
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
  async transferScoreFromBotToUser(user, scoreChange, from: any | undefined) {
    const userName = user.name ? user.name : user;
    const search = user.slackId ? { slackId: user.slackId } : { name: userName };

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
    if (from && from.name && (scoreChange > 1 || scoreChange < -1)) {
      const fromSearch = from.slackId ? { slackId: from.slackId } : { name: from.name };
      await db.collection(scoresDocumentName).updateOne(fromSearch, { $inc: { token: -scoreChange } });
    }
    return result.value;
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