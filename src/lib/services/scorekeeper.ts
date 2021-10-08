import { DatabaseService } from './database';
import { Helpers } from '../helpers';
import EventEmitter from 'events';
import { User } from '../data/scores';

export class ScoreKeeper {
  databaseService: DatabaseService;
  eventEmitter: EventEmitter;
  spamMessage: string;
  /*
  * params.robot
  * params.peerFeedbackUrl
  * params.furtherFeedbackSuggestedScore
  * params.spamMessage
  * params.mongoUri
  */
  constructor(params) {
    this.eventEmitter = new EventEmitter();
    for (const key in params) {
      this[key] = params[key];
    }
    this.spamMessage = params.spamMessage;
    this.databaseService = new DatabaseService(params);
    this.databaseService.init(); // this is async but it is just initializing the db connection, we let it run
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
  async incrementScore(to: any, from: any, channel: string, reason: string, incrementValue: number) {
    from = typeof from === 'string' ? { name: from, id: from } : from;
    let toUser;
    let fromUser;
    try {
      toUser = await this.getUser(to);
      fromUser = await this.getUser(from);
      if ((await this.isSpam(toUser, fromUser)) || this.isSendingToSelf(toUser, fromUser) || this.isBotInDm(from, channel)) {
        throw new Error(`I'm sorry <@${fromUser.slackId}>, I'm afraid I can't do that.`);
      }
      toUser.score = parseInt(toUser.score, 10) + incrementValue;
      if (reason) {
        const oldReasonScore = toUser.reasons[`${reason}`] ? toUser.reasons[`${reason}`] : 0;
        toUser.reasons[`${reason}`] = oldReasonScore + incrementValue;
      }

      await this.databaseService.savePointsGiven(from, toUser, incrementValue);
      let saveResponse = await this.databaseService.saveUser(toUser);
      try {
        await this.databaseService.savePlusPlusLog(toUser, fromUser, channel, reason, incrementValue);
      } catch (e) {
        //Logger.error(`failed saving spam log for user ${toUser.name} from ${from.name} in channel ${channel} because ${reason}`, e);
      }

      if (saveResponse && saveResponse.accountLevel > 1) {
        saveResponse = await this.databaseService.transferScoreFromBotToUser(toUser, incrementValue, fromUser);
      }
      return { toUser: saveResponse, fromUser };
    } catch (e) {
      //Logger.error(`failed to ${incrementValue > 0 ? 'add' : 'subtract'} point to [${to.name || 'no to'}] from [${from ? from.name : 'no from'}] because [${reason}] object [${JSON.stringify(toUser)}]`, e);
      throw e;
    }
  }

  async transferTokens(to, from, channel, reason, numberOfTokens) {
    let toUser;
    let fromUser;
    try {
      toUser = await this.getUser(to);
      fromUser = await this.getUser(from);
      if (toUser.accountLevel >= 2 && fromUser.accountLevel >= 2) {
        if ((await this.isSpam(toUser, fromUser)) || this.isSendingToSelf(toUser, fromUser) || this.isBotInDm(from, channel)) {
          throw new Error(`I'm sorry <@${fromUser.slackId}>, I'm afraid I can't do that.`);
        }
        if (fromUser.token >= parseInt(numberOfTokens, 10)) {
          fromUser.token = parseInt(fromUser.token, 10) - parseInt(numberOfTokens, 10);
          toUser.token = parseInt(toUser.token, 10) + parseInt(numberOfTokens, 10);
          if (reason) {
            const oldReasonScore = toUser.reasons[`${reason}`] ? toUser.reasons[`${reason}`] : 0;
            toUser.reasons[`${reason}`] = oldReasonScore + numberOfTokens;
          }

          await this.databaseService.savePointsGiven(from, toUser, numberOfTokens);
          const saveResponse = await this.databaseService.saveUser(toUser);
          try {
            await this.databaseService.savePlusPlusLog(toUser, fromUser, channel, reason, numberOfTokens);
          } catch (e) {
            //Logger.error(`failed saving spam log for user ${toUser.name} from ${from.name} in channel ${channel} because ${reason}`, e);
          }
          await this.databaseService.saveUser(fromUser);
          return {
            toUser: saveResponse,
            fromUser,
          };
        } else {
          // from has too few tokens to send that many
          throw new Error(`You don't have enough tokens to send ${numberOfTokens} to ${toUser.name}`);
        }
      } else {
        // to or from is not level 2
        throw new Error(`In order to send tokens to ${toUser.name} you both must be, at least, level 2.`);
      }
    } catch (e) {
      //Logger.error(`failed to transfer tokens to [${to.name || 'no to'}] from [${from ? from.name : 'no from'}] because [${reason}] object [${toUser.name}]`, e);
      throw e;
    }
  }

  async getUser(user): Promise<User> {
    const dbUser = await this.databaseService.getUser(user) as User;
    return dbUser;
  }

  async erase(user, from, channel, reason) {
    if (reason) {
      //Logger.error(`Erasing score for reason ${reason} for ${user} by ${from}`);
      await this.databaseService.erase(user, reason);
      return true;
    }
    //Logger.error(`Erasing all scores for ${user} by ${from}`);
    await this.databaseService.erase(user, undefined);

    return true;
  }

  isSendingToSelf(to, from) {
    //Logger.debug(`Checking if is to self. To [${to.name}] From [${from.name}], Valid: ${to.name !== from.name}`);
    const isToSelf = to.name === from.name;
    if (isToSelf) {
      this.eventEmitter.emit('plus-plus-spam', {
        to,
        from,
        message: this.spamMessage,
        reason: 'Looks like you may be trying to send a point to yourself.',
      });
    }
    return isToSelf;
  }

  async isSpam(to, from) {
    const toId = to.slackId || to.name;
    const fromId = from.slackId || from.name;
    //Logger.debug(`Checking spam to [${to.name}] from [${from.name}]`);
    const isSpam = await this.databaseService.isSpam(toId, fromId);
    if (isSpam) {
      this.eventEmitter.emit('plus-plus-spam', {
        to,
        from,
        message: this.spamMessage,
        reason: `You recently sent <@${toId}> a point.`,
      });
    }
    return isSpam;
  }

  /*
  * tries to detect bots
  * from - object from the message.user
  * return {boolean} true if it is a bot
  */
  isBotInDm(from, channel) {
    let isBot = false;
    if (from.is_bot && Helpers.isPrivateMessage(channel)) {
      isBot = true;
      //Logger.error('A bot is sending points in DM');
    }
    if (isBot) {
      this.eventEmitter.emit('plus-plus-spam', {
        to: undefined,
        from,
        message: this.spamMessage,
        reason: 'You can\'t have a bot do the dirty work.',
      });
    }
    return isBot;
  }
}
