import { Md } from 'slack-block-builder';

import { app } from '@/app';
import { config } from '@/config';

import {
	adminService,
	botTokenService,
	configService,
	installService,
	scoreLogsService,
	SpamService,
	spamService,
	userService,
} from '@/lib/services';
import { eventBus } from '@/lib/services/eventBus';
import { type PPSpamEvent, PPSpamEventName } from '@/lib/types';
import { withNamespace } from '@/logger';

import type { IScoreLog, IUser } from '@/models';
import type { ChatPostMessageArguments } from '@slack/web-api';

export class ScorekeeperService {
	constructor(private logger = withNamespace('scorekeeperService')) {}
	/**
	 * Method to allow up or down vote of a user
	 *
	 * userName - the user who is receiving the score change
	 * from - the user object that is sending the score change
	 * reason - the reason for score change
	 * incrementValue - [number] the value to change the score by
	 * return scoreObject - the new document for the user who received the score
	 */
	async incrementScore(
		teamId: string,
		toId: string,
		fromId: string,
		channelId: string,
		incrementValue: number,
		reason?: string,
	): Promise<{ toUser: IUser; fromUser: IUser }> {
		try {
			const toUser = await userService.findOneBySlackIdOrCreate(teamId, toId);
			const fromUser = await userService.findOneBySlackIdOrCreate(teamId, fromId);
			const bot = await botTokenService.find();
			const pointdPalConfig = await configService.findOneOrCreate(teamId);
			const install = await installService.findOne(teamId);

			if (fromUser.isBot === true) {
				throw new Error("Bots can't send points, silly.");
			}

			if ((await spamService.isSpam(teamId, toUser, fromUser)) || this.isSendingToSelf(teamId, toUser, fromUser)) {
				throw new Error(`I'm sorry ${Md.user(fromUser.slackId)}, I'm afraid I can't do that.`);
			}
			toUser.score = toUser.score + incrementValue;
			if (reason) {
				const newReasonScore = (toUser.reasons[reason] ?? 0) + incrementValue;
				toUser.reasons[reason] = newReasonScore;
			}

			//await this.databaseService.savePointsGiven(fromUser, toUser, incrementValue);
			this.logger.debug(`Adding a points given to`, fromUser, Math.abs(incrementValue));
			const newScore: number = (fromUser.pointsGiven?.[toUser.id] ?? 0) + Math.abs(incrementValue);
			fromUser.pointsGiven[toUser.id] = newScore;
			fromUser.totalPointsGiven = fromUser.totalPointsGiven + incrementValue;
			if (
				pointdPalConfig.formalFeedbackUrl &&
				newScore % pointdPalConfig.formalFeedbackModulo === 0 &&
				install?.installation.bot?.token
			) {
				await app.client.chat.postMessage({
					token: install.installation.bot.token,
					channel: fromUser.slackId,
					text: `Looks like you've given ${Md.user(
						toUser.slackId,
					)} quite a few points, maybe should submit a formal praise ${Md.link(pointdPalConfig.formalFeedbackUrl)}`,
				} as ChatPostMessageArguments);
			}

			try {
				const scoreLog = {
					from: fromUser.slackId,
					to: toUser.slackId,
					date: new Date(),
					channelId,
					reason,
					scoreChange: incrementValue,
				} as IScoreLog;
				await scoreLogsService.create(teamId, scoreLog);
			} catch (e) {
				this.logger.error(
					`failed saving spam log for user ${toUser.name} from ${fromUser.name} in channel ${channelId} because ${reason}`,
					e,
				);
			}

			if (toUser && toUser.accountLevel > 1) {
				if (bot) {
					bot.token = bot.token - incrementValue;
				}
				toUser.token = toUser.token + incrementValue;
				//saveResponse = await this.databaseService.transferScoreFromBotToUser(toUser, incrementValue, fromUser);
			}
			await userService.update(teamId, toUser);
			await userService.update(teamId, fromUser);
			if (bot) await botTokenService.update(bot.id!, bot);

			return { toUser, fromUser };
		} catch (e) {
			this.logger.error(
				`failed to ${incrementValue > 0 ? 'add' : 'subtract'} point to [${toId}] from [${fromId}] because [${
					reason ? reason : 'no reason'
				}]`,
				e,
			);
			throw e;
		}
	}

	async transferTokens(
		teamId: string,
		toId: string,
		fromId: string,
		channelId: string,
		numberOfTokens: number,
		reason?: string,
	): Promise<{ toUser: IUser; fromUser: IUser }> {
		try {
			const toUser = await userService.findOneBySlackIdOrCreate(teamId, toId);
			const fromUser = await userService.findOneBySlackIdOrCreate(teamId, fromId);
			if (toUser.accountLevel < 2 && fromUser.accountLevel < 2) {
				// to or from is not level 2
				throw new Error(`In order to send tokens to ${Md.user(toUser.slackId)} you both must be, at least, level 2.`);
			}

			if (fromUser.token && fromUser.token < numberOfTokens) {
				// from has too few tokens to send that many
				throw new Error(`You don't have enough tokens to send ${numberOfTokens} to ${Md.user(toUser.slackId)}`);
			}

			if ((await spamService.isSpam(teamId, toUser, fromUser)) || this.isSendingToSelf(teamId, toUser, fromUser)) {
				throw new Error(`I'm sorry ${Md.user(fromUser.slackId)}, I'm afraid I can't do that.`);
			}

			fromUser.token = (fromUser.token ?? 0) - numberOfTokens;
			toUser.token = (toUser.token ?? 0) + numberOfTokens;
			if (reason) {
				const newReasonScore = (toUser.reasons[reason] ?? 0) + numberOfTokens;
				toUser.reasons[reason] = newReasonScore;
			}

			const newScore: number = (fromUser.pointsGiven[toUser.slackId] ?? 0) + Math.abs(numberOfTokens);
			fromUser.pointsGiven[toUser.slackId] = newScore;
			fromUser.totalPointsGiven = fromUser.totalPointsGiven + numberOfTokens;
			try {
				await scoreLogsService.create(teamId, {
					from: fromUser.slackId,
					to: toUser.slackId,
					date: new Date(),
					channelId,
					reason,
					scoreChange: numberOfTokens,
				});
			} catch (e) {
				this.logger.error(
					`failed saving spam log for user ${toUser.name} from ${fromUser.name} in channel ${channelId} because ${
						reason ? reason : 'no reason'
					}`,
					e,
				);
			}
			await userService.update(teamId, toUser);
			await userService.update(teamId, fromUser);
			return {
				toUser,
				fromUser,
			};
		} catch (e) {
			this.logger.error(
				`failed to transfer tokens to [${toId}] from [${fromId}] because [${reason ? reason : 'no reason'}]`,
				e,
			);
			throw e;
		}
	}

	async erase(teamId: string, toBeErased: IUser, admin: IUser, channel: string, reason?: string) {
		this.logger.error(`Erasing all scores for ${toBeErased.name} by ${admin.name}`);
		await adminService.erase(teamId, toBeErased, reason);

		return true;
	}

	isSendingToSelf(teamId: string, recipient: IUser, sender: IUser) {
		this.logger.debug(
			`Checking if is to self. To [${recipient.name}] From [${sender.name}], Valid: ${recipient.id !== sender.id}`,
		);
		const isToSelf = recipient.id === sender.id;
		if (isToSelf) {
			const spamEvent: PPSpamEvent = {
				recipient,
				sender,
				notificationMessage: config.get('spam.responseMessage'),
				reason: 'Looks like you may be trying to send a point to yourself.',
				teamId,
			};
			eventBus.emit(PPSpamEventName, spamEvent);
		}
		return isToSelf;
	}
}

export const scorekeeperService = new ScorekeeperService();
