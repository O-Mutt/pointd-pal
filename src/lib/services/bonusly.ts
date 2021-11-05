import Axios, { AxiosError } from 'axios';
import { QraftyConfig } from '../models/qraftyConfig';
import { IUser } from '../models/user';
import { connectionFactory } from './connectionsFactory';
import { Helpers as H } from '../helpers';

export class BonuslyService {
  constructor() {
  }

  /**
   *
   * @param {string} slackId the slack id of the user to find
   * @returns the user from the scores db, undefined if not found
   */
  static async sendBonus(teamId: string, senderEmail: string, recipientEmails: string[], amount: number, reason?: string) {
    const qraftyConfig = await QraftyConfig(connectionFactory(teamId)).findOneOrCreate(teamId);
    if (!qraftyConfig.bonuslyConfig || qraftyConfig.bonuslyConfig.enabled !== true || !qraftyConfig.bonuslyConfig.url || !qraftyConfig.bonuslyConfig.apiKey) {
      console.error('bonusly config missing for the team');
      return;
    }

    console.log(`Sending a bonusly ${teamId}, ${senderEmail} ${recipientEmails.join(',')} ${amount} ${reason ? reason : 'no reason'} ${qraftyConfig.bonuslyConfig.get('apiKey', String, { getters: false })} ${qraftyConfig.bonuslyConfig.url.toString()}`);
    const axios = Axios.create({
      baseURL: qraftyConfig.bonuslyConfig.url.toString(),
      headers: {
        Authorization: `Bearer ${qraftyConfig.bonuslyConfig.get('apiKey', String, { getters: false })}`,
        'Content-Type': 'application/json',
      },
    });
    if (reason) {
      reason = H.decode(reason);
    } else {
      reason = qraftyConfig.bonuslyConfig.defaultReason;
    }

    let hashtag = qraftyConfig.bonuslyConfig.defaultHashtag;
    // check if the reason has a hashtag already in it
    if (reason && /(#\w+)/i.test(reason)) {
      const match = reason.match(/(#\w+)/i);
      hashtag = match ? match[0] : qraftyConfig.bonuslyConfig.defaultHashtag;
    }

    let data: any[] = [];

    for (const recipientEmail of recipientEmails) {
      try {
        console.log(`send the bonus (${qraftyConfig.bonuslyConfig.url.toString()}) giver: ${senderEmail} receiver: ${recipientEmail} amount ${amount} hashtag ${hashtag} reason ${reason}`);
        const response = await axios.post(`/bonuses`, {
          giver_email: senderEmail,
          receiver_email: recipientEmail,
          amount: amount,
          hashtag,
          reason,
        });
        if (response.data.success === false) {
          const values = {
            success: false,
            message: response.data.message
          }
          data.push(values);
        } else {
          const values = {
            success: true,
            amount_with_currency: response.data.result.amount_with_currency,
            giving_balance_with_currency: response.data.result.giver.giving_balance_with_currency
          }
          data.push(values);
        }
      } catch (e: any | unknown) {
        console.error('[ERROR] Error sending bonusly bonus', e);
      }
    }

    return data;
  }
}
