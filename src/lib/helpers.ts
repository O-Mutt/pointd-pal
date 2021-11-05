import { SlackEventMiddlewareArgs } from '@slack/bolt';
import moment from 'moment';
import { Md, SlackMessageDto } from 'slack-block-builder';
import { IUser } from './models/user';
import { regExpCreator } from './regexpCreator';

export class Helpers {
  static getEsOnEndOfWord(number: number) {
    if (number === -1 || number === 1) {
      return '';
    }
    return 's';
  }

  static capitalizeFirstLetter(str: string): string {
    if (!str) {
      return '';
    }
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  static isCakeDay(dateObject: Date): boolean {
    try {
      const robotDay = moment(dateObject);
      const today = moment();
      if (robotDay.date() === today.date() && robotDay.month() === today.month()) {
        return true;
      }
    } catch (e) {
      ////Logger.debug('There was an error in the isCakeDay function', e);
    }
    return false;
  }

  static getYearsAsString(dateObj: Date): string {
    const robotDay = new Date(dateObj);
    const today = new Date();
    const years = today.getFullYear() - robotDay.getFullYear();
    const lastDigit = years.toString().split('').pop();
    if (years === 0) {
      return '';
    }
    if (lastDigit === '1') {
      return `${years}st `;
    }
    if (lastDigit === '2') {
      return `${years}nd `;
    }
    if (lastDigit === '3') {
      return `${years}rd `;
    }
    return `${years}th `;
  }

  static getMessageForNewScore(user: IUser, reason: string | undefined): string {
    if (!user) {
      return '';
    }
    let scoreStr = `${Md.user(user.slackId)} has ${user.score} point${Helpers.getEsOnEndOfWord(user.score)}`;
    let reasonStr = '.';
    let cakeDayStr = '';

    if (user.score % 100 === 0) {
      let scoreFlareStr = user.score.toString();
      if (user.score === 0) {
        scoreFlareStr = 'zero';
      }
      const extraFlare = `:${scoreFlareStr}:`;
      scoreStr = `${extraFlare} ${scoreStr} ${extraFlare}`;
      reasonStr = '';
    }

    if (user.accountLevel && user.accountLevel > 1) {
      let tokenStr = `(*${user.qraftyToken} Qrafty Token${Helpers.getEsOnEndOfWord(user.qraftyToken)}*)`;
      scoreStr = scoreStr.concat(` ${tokenStr}`);
    }

    if (reason) {
      const decodedReason = Helpers.decode(reason);
      if (user.reasons.get(reason) === 1 || user.reasons.get(reason) === -1) {
        if (user.score === 1 || user.score === -1) {
          reasonStr = ` for ${decodedReason}.`;
        } else {
          reasonStr = `, ${user.reasons.get(reason)} of which is for ${decodedReason}.`;
        }
      } else if (user.reasons.get(reason) === 0) {
        reasonStr = `, none of which are for ${decodedReason}.`;
      } else {
        reasonStr = `, ${user.reasons.get(reason)} of which are for ${decodedReason}.`;
      }
    }

    if (Helpers.isCakeDay(user.robotDay)) {
      const yearsAsString = Helpers.getYearsAsString(user.robotDay);
      cakeDayStr = `\n:birthday: Today is ${Md.user(user.slackId)}'s ${yearsAsString}Qraftyday! :birthday:`;
    }
    return `${scoreStr}${reasonStr}${cakeDayStr}`;
  }

  static getMessageForTokenTransfer(to: IUser, from: IUser, number: number, reason: string | undefined) {
    if (!to) {
      return '';
    }

    const scoreStr = `${Md.user(from.slackId)} transferred *${number}* Qrafty Token${Helpers.getEsOnEndOfWord(number)} to ${Md.user(to.slackId)}.\n
${Md.user(to.slackId)} now has ${to.qraftyToken} token${Helpers.getEsOnEndOfWord(to.qraftyToken || 0)}`;
    let reasonStr = '.';
    let cakeDayStr = '';

    if (reason) {
      const decodedReason = Helpers.decode(reason);
      if (to.reasons.get(reason) === 1 || to.reasons.get(reason) === -1) {
        if (to.score === 1 || to.score === -1) {
          reasonStr = ` for ${decodedReason}.`;
        } else {
          reasonStr = `, ${to.reasons.get(reason)} of which is for ${decodedReason}.`;
        }
      } else if (to.reasons.get(reason) === 0) {
        reasonStr = `, none of which are for ${decodedReason}.`;
      } else {
        reasonStr = `, ${to.reasons.get(reason)} of which are for ${decodedReason}.`;
      }
    }

    if (Helpers.isCakeDay(to.robotDay)) {
      const yearsAsString = Helpers.getYearsAsString(to.robotDay);
      cakeDayStr = `\n:birthday: Today is ${Md.user(to.slackId)}'s ${yearsAsString}Qraftyday! :birthday:`;
    }
    return `${scoreStr}${reasonStr}${cakeDayStr}\n_${Md.user(from.slackId)} has ${from.qraftyToken} token${Helpers.getEsOnEndOfWord(
      from.qraftyToken || 0,
    )}_`;
  }

  /*
   * checks if the message is in DM
   * channel - {string} name of the channel
   */
  static isPrivateMessage(channel: string): boolean {
    // "Shell" is the adapter for running in the terminal
    return channel[0] === 'D' || channel === 'Shell';
  }

  static isKnownFalsePositive(premessage, conjunction, reason, operator) {
    const falsePositive = premessage && !conjunction && reason && operator.match(regExpCreator.negativeOperators);
    return falsePositive;
  }

  static getProcessVariables(env: { [key: string]: string | undefined }): ProcessVariable {
    return {
      spamMessage: env.HUBOT_SPAM_MESSAGE || 'Looks like you hit the spam filter. Please slow your roll.',
      spamTimeLimit: (env.SPAM_TIME_LIMIT && parseInt(env.SPAM_TIME_LIMIT, 10)) || 5,
      mongoUri: env.MONGO_URI || 'mongodb://localhost/plusPlus',
      cryptoRpcProvider: env.HUBOT_CRYPTO_RPC_PROVIDER || undefined,
      magicNumber: env.HUBOT_UNIMPORTANT_MAGIC_NUMBER || undefined,
      magicIv: env.HUBOT_UNIMPORTANT_MAGIC_IV || undefined,
      furtherHelpUrl: (env.HUBOT_CRYPTO_FURTHER_HELP_URL && new URL(env.HUBOT_CRYPTO_FURTHER_HELP_URL)) || undefined,
      monthlyScoreboardCron: env.HUBOT_PLUSPLUS_MONTHLY_SCOREBOARD_CRON || '0 10 1-7 * *',
      monthlyScoreboardDayOfWeek:
        (env.HUBOT_PLUSPLUS_MONTHLY_SCOREBOARD_DAY_OF_WEEK &&
          parseInt(env.HUBOT_PLUSPLUS_MONTHLY_SCOREBOARD_DAY_OF_WEEK, 10)) ||
        1, // 0-6 (Sun - Sat)
      defaultDb: env.DEFAULT_DB_NAME || undefined,
    };
  }

  static cleanAndEncode(str: string | null | undefined): string | undefined {
    if (!str) {
      return;
    }

    // this should fix a dumb issue with mac quotes
    const trimmed = JSON.parse(JSON.stringify(str.trim().toLowerCase()));
    const buff = Buffer.from(trimmed);
    const base64data = buff.toString('base64');
    return base64data;
  }

  static decode(str: string): string | undefined {
    if (!str) {
      return undefined;
    }

    const buff = Buffer.from(str, 'base64');
    const text = buff.toString('utf-8');
    return text;
  }

  static obfuscate(str: string, amountToLeaveUnobfuscated: number = 3): string {
    if (!str) {
      return str;
    }
    const backwards = Helpers.reverseString(str);
    let obfuscatedString = backwards;
    if (backwards.length > amountToLeaveUnobfuscated) {
      obfuscatedString = backwards.slice(0, amountToLeaveUnobfuscated) + backwards.slice(amountToLeaveUnobfuscated, str.length).replace(/./g, '*');
    }
    return Helpers.reverseString(obfuscatedString);
  }

  static reverseString(str: string) {
    return str.split("").reverse().join("");
  }

  static isScoreboardDayOfWeek(dayOfWeek: number): boolean {
    //Logger.debug(`Run the cron but lets check what day it is Moment day: [${moment().day()}], Configured Day of Week: [${monthlyScoreboardDayOfWeek}], isThatDay: [${moment().day() === monthlyScoreboardDayOfWeek}]`);
    const isToday = moment().day() === dayOfWeek;
    return isToday;
  }

  static getSayMessageArgs(message: any, text: string): any {
    if (Helpers.isMessageInThread(message)) {
      return { text, thread_ts: message.thread_ts };
    }
    return { text };
  }

  static getMessageTs(message: any): string {
    if (Helpers.isMessageInThread(message)) {
      return message.thread_ts;
    }
    return message.ts;
  }

  static getMessageParentTs(message: any): string | undefined {
    if (Helpers.isMessageInThread(message)) {
      return message.ts;
    }
    return;
  }

  static isMessageInThread(message): boolean {
    if (message.thread_ts) {
      return true;
    }
    return false;
  }
}

type ProcessVariable = {
  spamMessage: string;
  spamTimeLimit: number;
  mongoUri: string;
  cryptoRpcProvider?: string;
  magicNumber?: string;
  magicIv?: string;
  furtherHelpUrl?: URL;
  monthlyScoreboardCron: string;
  monthlyScoreboardDayOfWeek: number;
  defaultDb?: string;
};
