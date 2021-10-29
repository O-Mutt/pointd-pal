import axios from 'axios';
import { QraftyConfig } from '../models/qraftyConfig';
import { IUser } from '../models/user';
import { connectionFactory } from './connectionsFactory';

export class BonuslyService {
  constructor() { }

  /**
   *
   * @param {string} slackId the slack id of the user to find
   * @returns the user from the scores db, undefined if not found
   */
  static async sendBonus(teamId: string, sender: IUser, recipients: IUser[], amount: number, reason?: string) {
    const qraftyConfig = await QraftyConfig(connectionFactory(teamId)).findOneOrCreate(teamId);
    //logger.debug(`Sending a bonusly bonus to ${JSON.stringify(event.recipient.slackEmail)} from ${JSON.stringify(event.sender.slackEmail)}`);
    if (!reason) {
      reason = `point given through qrafty`;
    } else {
      const buff = Buffer.from(reason, 'base64');
      reason = buff.toString('utf-8');
    }

    let hashtag = qraftyConfig.bonuslyConfig?.defaultReason;
    // check if the reason has a hashtag already in it
    if (reason && /(#\w+)/i.test(reason)) {
      const match = reason.match(/(#\w+)/i);
      hashtag = match ? match[0] : qraftyConfig.bonuslyConfig?.defaultReason;
    }

    let data: any[] = [];

    for (const recipient of recipients) {
      try {
        const response = await axios.post('/api/v1/bonuses', {
          giver_email: sender.email,
          receiver_email: recipient.email,
          amount: amount,
          hashtag,
          reason,
        });
        data.push(response.data);
      } catch (e: any) {
        //logger.error('Error sending bonusly bonus', e);
        data.push(e.response.data);
      }
    }

    return data;
  }
}
