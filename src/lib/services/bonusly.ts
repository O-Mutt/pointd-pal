

import { Helpers } from "../helpers";
import axios from 'axios';
import { BonuslyBotConfig } from "../models/bonusly";

export class BonuslyService {
  procVars = Helpers.createProcVars(process.env);

  constructor() {
  }

  /**
   *
   * @param {string} slackId the slack id of the user to find
   * @returns the user from the scores db, undefined if not found
   */
  async sendBonus(event) {
    BonuslyBotConfig
    this.robot.logger.debug(`Sending a bonusly bonus to ${JSON.stringify(event.recipient.slackEmail)} from ${JSON.stringify(event.sender.slackEmail)}`);
    let reason = `point given through ${this.robot.name}`;
    if (event.reason) {
      const buff = new Buffer.from(event.reason, 'base64');
      reason = buff.toString('UTF-8');
    }

    let hashtag = this.defaultReason;
    if (reason && /(#\w+)/i.test(reason)) {
      const match = reason.match(/(#\w+)/i);
      hashtag = match ? match[0] : this.defaultReason;
    }

    let data;
    try {
      ({ data } = await axios.post('/api/v1/bonuses', {
        giver_email: event.sender.slackEmail,
        receiver_email: event.recipient.slackEmail,
        amount: event.amount,
        hashtag,
        reason,
      }));
    } catch (e) {
      this.robot.logger.error('Error sending bonusly bonus', e);
      data = e.response.data;
    }

    return data;
  }
}