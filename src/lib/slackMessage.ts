import { Md } from 'slack-block-builder';
import type { IUser } from '../models/user';
import type { KnownEventFromType } from '@slack/bolt';
import { negativeOperatorsRegexp } from './messageMatchers';
import { withNamespace } from '@/logger';

export class SlackMessage {
	constructor(private logger = withNamespace('slackMessage')) {}

	static getMessageForTokenTransfer(to: IUser, from: IUser, number: number, reason: string | undefined) {
		if (!to) {
			return '';
		}

		const scoreStr = `${Md.user(from.slackId)} transferred *${number}* Pointd Pal ${'Token'.pluralize(number)} to ${Md.user(to.slackId)}.\n${Md.user(to.slackId)} now has ${'token'.pluralize(to.token || 0, true)}`;
		let reasonStr = '.';
		let cakeDayStr = '';

		if (reason) {
			if (to.reasons[reason] === 1 || to.reasons[reason] === -1) {
				if (to.score === 1 || to.score === -1) {
					reasonStr = ` for ${reason}.`;
				} else {
					reasonStr = `, ${to.reasons[reason]} of which is for ${reason}.`;
				}
			} else if (to.reasons[reason] === 0) {
				reasonStr = `, none of which are for ${reason}.`;
			} else {
				reasonStr = `, ${to.reasons[reason]} of which are for ${reason}.`;
			}
		}

		if (to.pointdPalDay.isCakeDay()) {
			const yearsAsString = to.pointdPalDay.getYearsAsString();
			cakeDayStr = `\n:birthday: Today is ${Md.user(to.slackId)}'s ${yearsAsString} Pointd Pal day! :birthday:`;
		}
		return `${scoreStr}${reasonStr}${cakeDayStr}\n_${Md.user(from.slackId)} has ${'token'.pluralize(from.token || 0, true)}_`;
	}

	/*
	 * checks if the message is in DM
	 * channel - {string} name of the channel
	 */
	static isPrivateMessage(channel: string): boolean {
		// "Shell" is the adapter for running in the terminal
		return channel[0] === 'D' || channel === 'Shell';
	}

	static isKnownFalsePositive(premessage: string, conjunction: string, operator: string, reason?: string): boolean {
		const falsePositive = premessage && !conjunction && reason && operator.match(negativeOperatorsRegexp);
		return !!falsePositive;
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

export const slackMessage = new SlackMessage();
