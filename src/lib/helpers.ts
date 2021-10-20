import moment from 'moment';
import { IUser } from './models/user';
import { regExpCreator } from './regexpCreator';

export class Helpers {
  static getEsOnEndOfWord(number: number) {
    if (number === -1 || number === 1) {
      return '';
    }
    return 's';
  }

  static capitalizeFirstLetter(str: string) {
    if (typeof str !== 'string') {
      return '';
    }
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  static decode(str: string) {
    if (!str) {
      return undefined;
    }

    const buff = Buffer.from(str, 'base64');
    const text = buff.toString('utf8');
    return text;
  }

  static isCakeDay(dateObject: Date) {
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

  static getYearsAsString(dateObj: Date) {
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

  static getMessageForNewScore(user: IUser, reason: string | undefined, robotName: string): string {
    if (!user) {
      return '';
    }
    const username = user.slackId ? `<@${user.slackId}>` : user.name;
    let scoreStr = `${username} has ${user.score} point${Helpers.getEsOnEndOfWord(user.score)}`;
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
      let tokenStr = `(*${user.token} ${Helpers.capitalizeFirstLetter('qrafty')} Tokens*)`;
      if (user.token === 1) {
        tokenStr = `(*${user.token} ${Helpers.capitalizeFirstLetter('qrafty')} Token*)`;
      }
      scoreStr = scoreStr.concat(` ${tokenStr}`);
    }

    if (reason) {
      const decodedReason = Helpers.decode(reason);
      if (user.reasons[reason] === 1 || user.reasons[reason] === -1) {
        if (user.score === 1 || user.score === -1) {
          reasonStr = ` for ${decodedReason}.`;
        } else {
          reasonStr = `, ${user.reasons[reason]} of which is for ${decodedReason}.`;
        }
      } else if (user.reasons[reason] === 0) {
        reasonStr = `, none of which are for ${decodedReason}.`;
      } else {
        reasonStr = `, ${user.reasons[reason]} of which are for ${decodedReason}.`;
      }
    }

    if (Helpers.isCakeDay(user.robotDay)) {
      const yearsAsString = Helpers.getYearsAsString(user[`${'qrafty'}Day`]);
      cakeDayStr = `\n:birthday: Today is ${username}'s ${yearsAsString}${'qrafty'}day! :birthday:`;
    }
    return `${scoreStr}${reasonStr}${cakeDayStr}`;
  }

  static getMessageForTokenTransfer(robotName, to, from, number, reason) {
    if (!to) {
      return '';
    }
    const toTag = to.slackId ? `<@${to.slackId}>` : to.name;
    const fromTag = from.slackId ? `<@${from.slackId}>` : from.name;

    const scoreStr = `${fromTag} transferred *${number}* ${robotName} Tokens to ${toTag}.\n${toTag} now has ${
      to.token
    } token${Helpers.getEsOnEndOfWord(to.token)}`;
    let reasonStr = '.';
    let cakeDayStr = '';

    if (reason) {
      const decodedReason = Helpers.decode(reason);
      if (to.reasons[reason] === 1 || to.reasons[reason] === -1) {
        if (to.score === 1 || to.score === -1) {
          reasonStr = ` for ${decodedReason}.`;
        } else {
          reasonStr = `, ${to.reasons[reason]} of which is for ${decodedReason}.`;
        }
      } else if (to.reasons[reason] === 0) {
        reasonStr = `, none of which are for ${decodedReason}.`;
      } else {
        reasonStr = `, ${to.reasons[reason]} of which are for ${decodedReason}.`;
      }
    }

    if (Helpers.isCakeDay(to[`robotDay`])) {
      const yearsAsString = Helpers.getYearsAsString(to[`${robotName}Day`]);
      cakeDayStr = `\n:birthday: Today is ${toTag}'s ${yearsAsString}${robotName}day! :birthday:`;
    }
    return `${scoreStr}${reasonStr}${cakeDayStr}\n_${fromTag} has ${from.token} token${Helpers.getEsOnEndOfWord(
      from.token,
    )}_`;
  }

  static cleanName(name) {
    if (name) {
      let trimmedName = name.trim().toLowerCase();
      if (trimmedName.charAt(0) === ':') {
        trimmedName = trimmedName.replace(/(^\s*['"@])|([,'"\s]*$)/gi, '');
      } else {
        trimmedName = trimmedName.replace(/(^\s*['"@])|([,:'"\s]*$)/gi, '');
      }
      return trimmedName;
    }
    return name;
  }

  static cleanAndEncode(str): string {
    if (!str) {
      return '';
    }

    // this should fix a dumb issue with mac quotes
    const trimmed = JSON.parse(JSON.stringify(str.trim().toLowerCase()));
    const buff = Buffer.from(trimmed);
    const base64data = buff.toString('base64');
    return base64data;
  }

  /*
   * checks if the message is in DM
   * channel - {string} name of the channel
   */
  static isPrivateMessage(channel) {
    // "Shell" is the adapter for running in the terminal
    return channel[0] === 'D' || channel === 'Shell';
  }

  static isKnownFalsePositive(premessage, conjunction, reason, operator) {
    const falsePositive = premessage && !conjunction && reason && operator.match(regExpCreator.negativeOperators);
    return falsePositive;
  }

  static getProcessVariables(env): ProcessVariable {
    return {
      reasonsKeyword: env.HUBOT_PLUSPLUS_REASONS || 'reasons',
      spamMessage: env.HUBOT_SPAM_MESSAGE || 'Looks like you hit the spam filter. Please slow your roll.',
      spamTimeLimit: env.SPAM_TIME_LIMIT || 5,
      companyName: env.HUBOT_COMPANY_NAME || 'Company Name',
      peerFeedbackUrl:
        env.HUBOT_PEER_FEEDBACK_URL ||
        `praise in Lattice (https://${env.HUBOT_COMPANY_NAME || 'Company Name'}.latticehq.com/)`,
      furtherFeedbackSuggestedScore: env.HUBOT_FURTHER_FEEDBACK_SCORE || 10,
      mongoUri: env.MONGO_URI || 'mongodb://localhost/plusPlus',
      cryptoRpcProvider: env.HUBOT_CRYPTO_RPC_PROVIDER || undefined,
      magicNumber: env.HUBOT_UNIMPORTANT_MAGIC_NUMBER || undefined,
      magicIv: env.HUBOT_UNIMPORTANT_MAGIC_IV || undefined,
      furtherHelpUrl: env.HUBOT_CRYPTO_FURTHER_HELP_URL || undefined,
      notificationsRoom: env.HUBOT_PLUSPLUS_NOTIFICATION_ROOM || undefined,
      falsePositiveNotificationsRoom: env.HUBOT_PLUSPLUS_FALSE_POSITIVE_NOTIFICATION_ROOM || undefined,
      monthlyScoreboardCron: env.HUBOT_PLUSPLUS_MONTHLY_SCOREBOARD_CRON || '0 10 1-7 * *',
      monthlyScoreboardDayOfWeek: env.HUBOT_PLUSPLUS_MONTHLY_SCOREBOARD_DAY_OF_WEEK || 1, // 0-6 (Sun - Sat)
      defaultDb: env.DEFAULT_DB_NAME || undefined,
    };
  }
}

type ProcessVariable = {
  reasonsKeyword: string;
  spamMessage: string;
  spamTimeLimit: number;
  companyName: string;
  peerFeedbackUrl: string;
  furtherFeedbackSuggestedScore: number;
  mongoUri: string;
  cryptoRpcProvider: string;
  magicNumber: string;
  magicIv: string;
  furtherHelpUrl: URL;
  notificationsRoom: string;
  falsePositiveNotificationsRoom: string;
  monthlyScoreboardCron: string;
  monthlyScoreboardDayOfWeek: number;
  defaultDb: string;
};
