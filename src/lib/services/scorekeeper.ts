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
  async incrementScore(toId: string, fromId: string, channel: string, reason: string, incrementValue: number, logger: any | undefined = undefined) {
    try {
      const toUser = await this.databaseService.getUser(toId, logger);
      const fromUser = await this.databaseService.getUser(fromId, logger);
      if (fromUser.isBot) {
        throw new Error('Bots can\'t send points, silly.');
      }

      if ((await this.databaseService.isSpam(toUser, fromUser)) || this.isSendingToSelf(toId, fromId)) {
        throw new Error(`I'm sorry <@${fromUser.id}>, I'm afraid I can't do that.`);
      }
      toUser.score = toUser.score + incrementValue;
      if (reason) {
        const oldReasonScore = toUser.reasons[`${reason}`] ? toUser.reasons[`${reason}`] : 0;
        toUser.reasons[`${reason}`] = oldReasonScore + incrementValue;
      }

      await this.databaseService.savePointsGiven(fromUser, toUser, incrementValue);
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

  async transferTokens(toId: string, from, channel, reason, numberOfTokens: number): Promise<{ toUser: User; fromUser: User; }> {
    try {
      const toUser = await this.databaseService.getUser(toId);
      const fromUser = await this.databaseService.getUser(from);
      if (toUser.accountLevel >= 2 && fromUser.accountLevel >= 2) {
        if ((await this.databaseService.isSpam(toUser, fromUser)) || this.isSendingToSelf(toUser, fromUser)) {
          throw new Error(`I'm sorry <@${fromUser.id}>, I'm afraid I can't do that.`);
        }
        if (fromUser.token && fromUser.token >= numberOfTokens) {
          fromUser.token = fromUser.token - numberOfTokens;
          toUser.token = toUser.token || 0 + numberOfTokens;
          if (reason) {
            const oldReasonScore = toUser.reasons[`${reason}`] ? toUser.reasons[`${reason}`] : 0;
            toUser.reasons[`${reason}`] = oldReasonScore + numberOfTokens;
          }

          await this.databaseService.savePointsGiven(fromUser, toUser, numberOfTokens);
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

  isSendingToSelf(toId, fromId) {
    //Logger.debug(`Checking if is to self. To [${to.name}] From [${from.name}], Valid: ${to.name !== from.name}`);
    const isToSelf = toId === fromId;
    if (isToSelf) {
      this.eventEmitter.emit('plus-plus-spam', {
        toId,
        fromId,
        message: this.spamMessage,
        reason: 'Looks like you may be trying to send a point to yourself.',
      });
    }
    return isToSelf;
  }
}
