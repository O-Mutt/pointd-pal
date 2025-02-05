import { Md } from 'slack-block-builder';
import { IUser } from '../entities/user';
import { regExpCreator } from './regexpCreator';
import { KnownEventFromType } from '@slack/bolt';

export class SlackMessage {
	static getMessageForTokenTransfer(to: IUser, from: IUser, number: number, reason: string | undefined) {
		if (!to) {
			return '';
		}

		const scoreStr = `${Md.user(from.slackId)} transferred *${number}* Pointd Pal ${'Token'.pluralize(number)} to ${Md.user(to.slackId)}.\n${Md.user(to.slackId)} now has ${to.pointdPalToken} ${'token'.pluralize(to.pointdPalToken || 0)}`;
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

		if (to.pointdPalDay.isCakeDay()) {
			const yearsAsString = to.pointdPalDay.getYearsAsString();
			cakeDayStr = `\n:birthday: Today is ${Md.user(to.slackId)}'s ${yearsAsString} Pointd Pal day! :birthday:`;
		}
		return `${scoreStr}${reasonStr}${cakeDayStr}\n_${Md.user(from.slackId)} has ${
			from.pointdPalToken
		} ${'token'.pluralize(from.pointdPalToken || 0)}_`;
	}

	/*
	 * checks if the message is in DM
	 * channel - {string} name of the channel
	 */
	static isPrivateMessage(channel: string): boolean {
		// "Shell" is the adapter for running in the terminal
		return channel[0] === 'D' || channel === 'Shell';
	}

	static isKnownFalsePositive(
		premessage: string,
		conjunction: string,
		reason: string,
		operator: string,
	): false | '' | RegExpMatchArray | null {
		const falsePositive = premessage && !conjunction && reason && operator.match(regExpCreator.negativeOperators);
		return falsePositive;
	}

	static getSayMessageArgs(message: unknown, text: string): { text: string; thread_ts?: string } {
		if (SlackMessage.isMessageInThread(message)) {
			// @ts-expect-error just shut up
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			return { text, thread_ts: message.thread_ts };
		}
		return { text };
	}

	static getMessageTs(message: unknown): string {
		if (SlackMessage.isMessageInThread(message)) {
			// @ts-expect-error just shut up
			// eslint-disable-next-line @typescript-eslint/no-unsafe-return
			return message.thread_ts;
		}
		return (message as KnownEventFromType<'message'>).ts;
	}

	static getMessageParentTs(message: unknown): string | undefined {
		if (SlackMessage.isMessageInThread(message)) {
			return (message as KnownEventFromType<'message'>).ts;
		}
		return;
	}

	static isMessageInThread(message: unknown): boolean {
		// @ts-expect-error just shut up
		if (message.thread_ts) {
			return true;
		}
		return false;
	}
}
