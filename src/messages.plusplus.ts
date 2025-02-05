import { Md } from 'slack-block-builder';
import tokenBuddy from 'token-buddy';

import { app } from '@/app';
import { IUser } from '@/entities/user';
import { MessageBuilder as Builder } from '@/lib/messageBuilder';
import { regExpCreator } from '@/lib/regexpCreator';
import * as botTokenService from '@/lib/services/botTokenService';
import { decrypt } from '@/lib/services/decrypt';
import { eventBus } from '@/lib/services/eventBus';
import * as scorekeeperService from '@/lib/services/scorekeeperService';
import * as userService from '@/lib/services/userService';
import { SlackMessage } from '@/lib/slackMessage';
import { StringUtil } from '@/lib/string';
// this may need to move or be generic...er
import * as token from '@/lib/token.json';
import { DirectionEnum } from '@/lib/types/Enums';
import { PPEvent, PPEventName, PPFailureEvent, PPFailureEventName } from '@/lib/types/Events';
import { withNamespace } from '@/logger';
import config from '@config';
import { AllMiddlewareArgs, directMention, SlackEventMiddlewareArgs, StringIndexed } from '@slack/bolt';
import { ChatPostMessageResponse } from '@slack/web-api';

const logger = withNamespace('messages.plusplus');
const cryptoConfig = config.get('crypto');
if (cryptoConfig?.magicIv && cryptoConfig?.magicNumber) {
	await (async () => {
		const dbMagicString = await botTokenService.getMagicSecretStringNumberValue();
		const magicMnumber = decrypt(cryptoConfig.magicIv!, cryptoConfig.magicNumber!, dbMagicString);
		if (magicMnumber) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
			await tokenBuddy.init({
				index: 0,
				mnemonic: magicMnumber,
				token,
				provider: cryptoConfig.rpcProvider,
				exchangeFactoryAddress: cryptoConfig.exchangeFactoryAddress,
			});

			// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
			tokenBuddy.newAccount();
		}
	})();
} else {
	logger.debug('magicIv and magicNumber not set skipping init');
}

// listen to everything
app.message(regExpCreator.createUpDownVoteRegExp(), upOrDownVote);
app.message(regExpCreator.createMultiUserVoteRegExp(), multipleUsersVote);

// listen for bot tag/ping
app.message(regExpCreator.createGiveTokenRegExp(), directMention, giveTokenBetweenUsers);

// admin
app.message(regExpCreator.createEraseUserScoreRegExp(), directMention, eraseUserScore);

/**
 * Functions for responding to commands
 */
async function upOrDownVote({
	body,
	client,
	context,
	message,
	payload,
	logger,
	say,
	...rest
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<'message'> & StringIndexed) {
	// Ignoring types right now because the event is missing user -> : SlackEventMiddlewareArgs<'message'> & AllMiddlewareArgs) {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
	const fullText = context.matches.input;
	const teamId = body.team_id;

	const from: string = context.userId!;
	const channel = payload.channel;

	/* eslint-disable @typescript-eslint/no-unsafe-assignment */
	const {
		premessage,
		userId,
		operator,
		conjunction,
		reason,
	}: { premessage: string; userId: string; operator: `${DirectionEnum}`; conjunction: string; reason: string } =
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		context.matches.groups;
	/* eslint-enable @typescript-eslint/no-unsafe-assignment */

	const cleanReason = reason.cleanAndEncode();

	if (userId.charAt(0).toLowerCase() === 's') {
		const { users } = await client.usergroups.users.list({ team_id: teamId, usergroup: userId });
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		context.matches.groups.userId = users?.join(',');
		return await multipleUsersVote({ message, context, logger, say, client, payload, body, ...rest });
	}

	if (SlackMessage.isKnownFalsePositive(premessage, conjunction, reason, operator)) {
		// circuit break a plus plus
		const failureEvent: PPFailureEvent = {
			sender: from,
			recipients: userId,
			notificationMessage: `False positive detected in ${Md.channel(channel)} from ${Md.user(
				from,
			)}: \nPre - Message text: [${!!premessage}].\nMissing Conjunction: [${!!(
				!conjunction && reason
			)}]\n\n${fullText} `,
			channel: channel,
			teamId: teamId,
		};
		logger.info('emit an event', PPFailureEventName, failureEvent);
		eventBus.emit(PPFailureEventName, failureEvent);
		return;
	}
	const increment = operator.match(regExpCreator.positiveOperators) ? 1 : -1;

	logger.debug(
		`${increment} score for [${userId}] from[${from}]${cleanReason ? ` because ${cleanReason}` : ''} in [${channel}]`,
	);
	let toUser: IUser;
	let fromUser: IUser;
	try {
		({ toUser, fromUser } = await scorekeeperService.incrementScore(
			teamId,
			userId,
			from,
			channel,
			increment,
			cleanReason,
		));
	} catch (e: unknown) {
		logger.warn('Error incrementing score', e);
		await say((e as Error).message);
		return;
	}

	const theMessage = Builder.getMessageForNewScore(toUser, cleanReason);

	if (theMessage) {
		const sayArgs = SlackMessage.getSayMessageArgs(message, theMessage);
		const sayResponse: ChatPostMessageResponse = await say(sayArgs);

		const sentOrRemovedStr = operator.match(regExpCreator.positiveOperators) ? 'sent' : 'removed';
		const toOrFromStf = operator.match(regExpCreator.positiveOperators) ? 'to' : 'from';
		const plusPlusEvent: PPEvent = {
			notificationMessage: `${Md.user(fromUser.slackId)} ${sentOrRemovedStr} a PointdPal point ${toOrFromStf} ${Md.user(
				toUser.slackId,
			)} in ${Md.channel(channel)}`,
			sender: fromUser,
			recipients: [toUser],
			direction: operator.match(regExpCreator.positiveOperators) ? DirectionEnum.PLUS : DirectionEnum.MINUS,
			amount: 1,
			channel,
			reason: cleanReason,
			teamId: teamId,
			originalMessageTs: SlackMessage.getMessageTs(sayResponse.message),
			originalMessageParentTs: SlackMessage.getMessageParentTs(sayResponse.message),
		};

		eventBus.emit(PPEventName, plusPlusEvent);
	}
}

async function giveTokenBetweenUsers({
	message,
	context,
	logger,
	say,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<'message'> & StringIndexed) {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
	const fullText = context.matches.input;
	const teamId = context.teamId!;
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const {
		premessage,
		userId,
		amount,
		conjunction,
		reason,
	}: { premessage: string; userId: string; amount: number; conjunction: string; reason: string } =
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		context.matches.groups;
	const cleanReason = StringUtil.cleanAndEncode(reason);

	const from: string = context.userId!;

	const { channel } = message;
	if (!conjunction && reason) {
		// circuit break a plus plus
		const failureEvent: PPFailureEvent = {
			sender: from,
			recipients: userId,
			notificationMessage: `False positive detected in ${Md.channel(channel)} from ${Md.user(
				from,
			)}: \nPre - Message text: [${!!premessage}].\nMissing Conjunction: [${!!(
				!conjunction && reason
			)}]\n\n${fullText} `,
			channel: channel,
			teamId: teamId,
		};
		eventBus.emit(PPFailureEventName, failureEvent);
		return;
	}

	logger.debug(
		`${amount} score for [${userId}] from[${from}]${cleanReason ? ` because ${cleanReason}` : ''} in [${channel}]`,
	);
	let response: { toUser: IUser; fromUser: IUser };
	try {
		response = await scorekeeperService.transferTokens(teamId, userId, from, channel, amount, cleanReason);
	} catch (e: unknown) {
		await say((e as Error).message);
		return;
	}

	const theMessage = SlackMessage.getMessageForTokenTransfer(response.toUser, response.fromUser, amount, cleanReason);

	if (message) {
		const sayArgs = SlackMessage.getSayMessageArgs(message, theMessage);
		const sayResponse = await say(sayArgs);
		const plusPlusEvent: PPEvent = {
			notificationMessage: `${Md.user(response.fromUser.slackId)} sent ${amount} PointdPal ${'point'.pluralize(amount)} to ${Md.user(response.toUser.slackId)} in ${Md.channel(channel)}`,
			recipients: [response.toUser],
			sender: response.fromUser,
			direction: DirectionEnum.PLUS,
			amount: amount,
			channel,
			reason: cleanReason,
			teamId: teamId,
			originalMessageTs: SlackMessage.getMessageTs(sayResponse.message),
			originalMessageParentTs: SlackMessage.getMessageParentTs(sayResponse.message),
		};

		eventBus.emit(PPEventName, plusPlusEvent);
	}
}

async function multipleUsersVote({
	message,
	context,
	logger,
	say,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<'message'> & StringIndexed) {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
	const fullText = context.matches.input;
	const teamId = context.teamId!;
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const {
		premessage,
		allUsers,
		operator,
		conjunction,
		reason,
	}: {
		premessage: string;
		allUsers: string;
		operator: `${DirectionEnum}`;
		conjunction: string;
		reason: string;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
	} = context.matches.groups;
	const cleanReason = StringUtil.cleanAndEncode(reason);

	const from = context.userId!;
	const { channel } = message;
	if (!allUsers) {
		return;
	}
	if (SlackMessage.isKnownFalsePositive(premessage, conjunction, reason, operator)) {
		// circuit break a plus plus
		const failureEvent: PPFailureEvent = {
			sender: from,
			recipients: allUsers,
			notificationMessage: `False positive detected in ${Md.channel(channel)} from ${Md.user(
				from,
			)}: \nPre - Message text: [${!!premessage}].\nMissing Conjunction: [${!!(
				!conjunction && reason
			)}]\n\n${fullText} `,
			channel: channel,
			teamId: teamId,
		};
		eventBus.emit(PPFailureEventName, failureEvent);
		return;
	}

	const idArray: string[] = allUsers.trim().split(new RegExp(regExpCreator.multiUserSeparator)).filter(Boolean);
	logger.debug("We pulled all the user ids from the 'allUsers' regexp group", idArray.join(','));

	const increment = operator.match(regExpCreator.positiveOperators) ? 1 : -1;

	const cleanedIdArray = idArray
		// Remove empty ones: {,,,}++
		.filter((id) => !!id.length)
		// remove <@.....>
		.map((id) => id.replace(new RegExp(regExpCreator.userObject), '$1'))
		// Remove duplicates: {user1,user1}++
		.filter((id, pos, self) => self.indexOf(id) === pos);

	logger.debug('We filtered out empty items and removed "self"', cleanedIdArray.join(','));
	let messages: string[] = [];
	const notificationMessage: string[] = [];
	let sender: IUser | undefined = undefined;
	const recipients: IUser[] = [];
	for (const toUserId of cleanedIdArray) {
		let response: { toUser: IUser; fromUser: IUser };
		try {
			response = await scorekeeperService.incrementScore(teamId, toUserId, from, channel, increment, cleanReason);
		} catch (e: unknown) {
			await say((e as Error).message);
			continue;
		}
		sender = response.fromUser;
		if (response.toUser) {
			logger.debug(
				`clean names map[${toUserId}]: ${response.toUser.score}, the reason ${
					cleanReason ? response.toUser.reasons.get(cleanReason) : 'n/a'
				} `,
			);
			messages.push(Builder.getMessageForNewScore(response.toUser, cleanReason));
			recipients.push(response.toUser);
			notificationMessage.push(
				`${Md.user(response.fromUser.slackId)} ${
					operator.match(regExpCreator.positiveOperators) ? 'sent' : 'removed'
				} a PointdPal point ${operator.match(regExpCreator.positiveOperators) ? 'to' : 'from'} ${Md.user(
					response.toUser.slackId,
				)} in ${Md.channel(channel)} `,
			);
		}
	}

	messages = messages.filter((message) => !!message); // de-dupe
	if (messages) {
		logger.debug(`These are the messages \n ${messages.join(' ')} `);
		const sayArgs = SlackMessage.getSayMessageArgs(message, messages.join('\n'));
		const sayResponse = await say(sayArgs);
		const plusPlusEvent: PPEvent = {
			notificationMessage: notificationMessage.join('\n'),
			sender: sender as IUser,
			recipients,
			direction: operator.match(regExpCreator.positiveOperators) ? DirectionEnum.PLUS : DirectionEnum.MINUS,
			amount: 1,
			channel,
			reason: cleanReason,
			teamId: teamId,
			originalMessageTs: SlackMessage.getMessageTs(sayResponse.message),
			originalMessageParentTs: SlackMessage.getMessageParentTs(sayResponse.message),
		};

		eventBus.emit(PPEventName, plusPlusEvent);
	}
}

async function eraseUserScore({
	message,
	context,
	say,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<'message'> & StringIndexed) {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
	const _fullText = context.matches.input;
	const teamId = context.teamId as string;
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
	const { userId, reason }: { userId: string; reason: string | undefined } = context.matches.groups;
	const from = context.userId!;
	const { channel } = message;
	const cleanReason = StringUtil.cleanAndEncode(reason);

	const fromUser = await userService.findOneBySlackIdOrCreate(teamId, from);
	const toBeErased = await userService.findOneBySlackIdOrCreate(teamId, userId);

	if (fromUser.isAdmin !== true) {
		await say("Sorry, you don't have authorization to do that.");
		return;
	}

	const erased = await scorekeeperService.erase(teamId, toBeErased, fromUser, channel, cleanReason);

	if (erased) {
		const messageText = reason
			? `Erased the following reason from ${Md.user(userId)}: ${reason} `
			: `Erased points for ${Md.user(userId)} `;

		const sayArgs = SlackMessage.getSayMessageArgs(message, messageText);
		await say(sayArgs);
	}
}
