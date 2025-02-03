import { SlackEventMiddlewareArgs } from '@slack/bolt';
import { getDayOfYear, differenceInYears } from 'date-fns';
import { Md } from 'slack-block-builder';
import { IUser } from '../entities/user';
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
			const pointdPalDay = getDayOfYear(dateObject);
			const today = getDayOfYear(new Date());
			if (pointdPalDay === today) {
				return true;
			}
		} catch (e) {
			////Logger.debug('There was an error in the isCakeDay function', e);
		}
		return false;
	}

	static getOrdinalSuffix(num: number): string {
		const j = num % 10;
		const k = num % 100;
		if (j === 1 && k !== 11) {
			return `${num}st`;
		}
		if (j === 2 && k !== 12) {
			return `${num}nd`;
		}
		if (j === 3 && k !== 13) {
			return `${num}rd`;
		}
		return `${num}th`;
	}

	static getYearsAsString(pointdPalDay: Date): string {
		const today = new Date();
		const years = differenceInYears(today, pointdPalDay);
		return this.getOrdinalSuffix(years);
	}

	static getMessageForTokenTransfer(to: IUser, from: IUser, number: number, reason: string | undefined) {
		if (!to) {
			return '';
		}

		const scoreStr = `${Md.user(from.slackId)} transferred *${number}* Pointd Pal Token${Helpers.getEsOnEndOfWord(
			number,
		)} to ${Md.user(to.slackId)}.\n${Md.user(to.slackId)} now has ${to.pointdPalToken} token${Helpers.getEsOnEndOfWord(to.pointdPalToken || 0)}`;
		let reasonStr = '.';
		let cakeDayStr = '';

		if (reason) {
			const decodedReason = reason.decode();
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

		if (Helpers.isCakeDay(to.pointdPalDay)) {
			const yearsAsString = Helpers.getYearsAsString(to.pointdPalDay);
			cakeDayStr = `\n:birthday: Today is ${Md.user(to.slackId)}'s ${yearsAsString} Pointd Pal day! :birthday:`;
		}
		return `${scoreStr}${reasonStr}${cakeDayStr}\n_${Md.user(from.slackId)} has ${
			from.pointdPalToken
		} token${Helpers.getEsOnEndOfWord(from.pointdPalToken || 0)}_`;
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

	static endsWithPunctuation(str: string): boolean {
		return !!str.match(/[.,:!?]$/);
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
