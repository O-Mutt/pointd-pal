import { DatabaseService } from './database';
import EventEmitter from 'events';
import { IUser } from '../models/user';
import { PlusPlusSpam, PlusPlusSpamEventName } from '../types/PlusPlusEvents';

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
  async incrementScore(teamId: string, toId: string, fromId: string, channel: string, reason: string, incrementValue: number) {
    try {
      const toUser = await this.databaseService.getUser(teamId, toId);
      const fromUser = await this.databaseService.getUser(teamId, fromId);
      if (fromUser.isBot === true) {
        throw new Error('Bots can\'t send points, silly.');
      }

      if ((await this.isSpam(teamId, toUser, fromUser)) || this.isSendingToSelf(toUser, fromUser)) {
        throw new Error(`I'm sorry <@${fromUser.slackId}>, I'm afraid I can't do that.`);
      }
      toUser.score = toUser.score + incrementValue;
      if (reason) {
        const oldReasonScore = toUser.reasons[`${reason}`] ? toUser.reasons[`${reason}`] : 0;
        toUser.reasons[`${reason}`] = oldReasonScore + incrementValue;
      }

      await this.databaseService.savePointsGiven(fromUser, toUser, incrementValue);
      await toUser.save();
      try {
        await this.databaseService.savePlusPlusLog(teamId, toUser, fromUser, channel, reason, incrementValue);
      } catch (e) {
        //Logger.error(`failed saving spam log for user ${toUser.name} from ${from.name} in channel ${channel} because ${reason}`, e);
      }

      if (toUser && toUser.accountLevel > 1 && incrementValue > 1) {
        //saveResponse = await this.databaseService.transferScoreFromBotToUser(toUser, incrementValue, fromUser);
      }
      return { toUser, fromUser };
    } catch (e) {
      //Logger.error(`failed to ${incrementValue > 0 ? 'add' : 'subtract'} point to [${to.name || 'no to'}] from [${from ? from.name : 'no from'}] because [${reason}] object [${JSON.stringify(toUser)}]`, e);
      throw e;
    }
  }

  async transferTokens(teamId: string, toId: string, fromId: string, channel: string, reason: string, numberOfTokens: number): Promise<{ toUser: IUser; fromUser: IUser; }> {
    try {
      const toUser = await this.databaseService.getUser(teamId, toId);
      const fromUser = await this.databaseService.getUser(teamId, fromId);
      if (toUser.accountLevel < 2 && fromUser.accountLevel < 2) {
        // to or from is not level 2
        throw new Error(`In order to send tokens to ${toUser.name} you both must be, at least, level 2.`);
      }

      if (fromUser.token && fromUser.token >= numberOfTokens) {
          // from has too few tokens to send that many
          throw new Error(`You don't have enough tokens to send ${numberOfTokens} to ${toUser.name}`);
      }

      if ((await this.databaseService.isSpam(teamId, toUser, fromUser)) || this.isSendingToSelf(toUser, fromUser)) {
        throw new Error(`I'm sorry <@${fromUser.slackId}>, I'm afraid I can't do that.`);
      }

      fromUser.token = fromUser.token || 0 - numberOfTokens;
      toUser.token = toUser.token || 0 + numberOfTokens;
      if (reason) {
        const oldReasonScore = toUser.reasons[`${reason}`] ? toUser.reasons[`${reason}`] : 0;
        toUser.reasons[`${reason}`] = oldReasonScore + numberOfTokens;
      }

      await this.databaseService.savePointsGiven(fromUser, toUser, numberOfTokens);
      try {
        await this.databaseService.savePlusPlusLog(teamId, toUser, fromUser, channel, reason, numberOfTokens);
      } catch (e) {
        //Logger.error(`failed saving spam log for user ${toUser.name} from ${from.name} in channel ${channel} because ${reason}`, e);
      }
      await toUser.save();
      await fromUser.save()
      return {
        toUser,
        fromUser,
      };
    } catch (e) {
      //Logger.error(`failed to transfer tokens to [${to.name || 'no to'}] from [${from ? from.name : 'no from'}] because [${reason}] object [${toUser.name}]`, e);
      throw e;
    }
  }

  async erase(teamId: string, user: IUser, from: IUser, channel: string, reason: string) {
    if (reason) {
      //Logger.error(`Erasing score for reason ${reason} for ${user} by ${from}`);
      await this.databaseService.erase(teamId, user, reason);
      return true;
    }
    //Logger.error(`Erasing all scores for ${user} by ${from}`);
    await this.databaseService.erase(teamId, user, undefined);

    return true;
  }

  async isSpam(teamId: string, to: IUser, from: IUser) {
    const isSpam = await this.databaseService.isSpam(teamId, to, from);
    if (isSpam) {
      const spamEvent = new PlusPlusSpam({
        to,
        from,
        message: this.spamMessage,
        reason: `You recently sent <@${to.slackId}> a point.`
      });

      this.eventEmitter.emit(PlusPlusSpamEventName, spamEvent);
    }
    return isSpam;
  }

  isSendingToSelf(to: IUser, from: IUser) {
    //Logger.debug(`Checking if is to self. To [${to.name}] From [${from.name}], Valid: ${to.name !== from.name}`);
    const isToSelf = to.slackId === from.slackId;
    if (isToSelf) {
      const spamEvent = new PlusPlusSpam({
        to,
        from,
        message: this.spamMessage,
        reason: 'Looks like you may be trying to send a point to yourself.'
      });
      this.eventEmitter.emit(PlusPlusSpamEventName, spamEvent);
    }
    return isToSelf;
  }
}
