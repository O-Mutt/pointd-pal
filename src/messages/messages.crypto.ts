import _ from 'lodash';
import { Blocks, Elements, Md, Message } from 'slack-block-builder';
import tokenBuddy from 'token-buddy';

import {
	directMention,
	type SlackActionMiddlewareArgs,
	type AllMiddlewareArgs,
	type SlackEventMiddlewareArgs,
	type StringIndexed,
	App,
} from '@slack/bolt';

import { levelUpAccountRegexp, botWalletRegexp } from '@/lib/messageMatchers';
import { ConfirmOrCancel, actions } from '@/lib/types';
import { userService } from '@/lib/services/userService';
import { databaseService } from '@/lib/services/databaseService';
import { SlackMessage } from '@/lib/slackMessage';
import { botTokenService } from '@/lib/services/botTokenService';

export function registerCrypto(app: App) {
	app.message(botWalletRegexp, directMention, botWalletCount);

	// DM only
	app.message(levelUpAccountRegexp, directMention, levelUpAccount);

	app.action(actions.message.confirmLevelUp, levelUpToLevelThree);
}

async function levelUpAccount({
	message,
	context,
	logger,
	say,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<'message'> & StringIndexed) {
	if (!SlackMessage.isPrivateMessage(message.channel)) {
		await say(`You should only execute a level up from within the context of a DM with PointdPal`);
		return;
	}
	const teamId = context.teamId as string;

	const user = await userService.getOrCreateBySlackId(teamId, context.userId!);
	if (user.accountLevel === 2) {
		const theBlocks = Message({ channel: message.channel, text: "Let's level you up!" })
			.blocks(
				Blocks.Section({
					text: `You are already Level 2, ${Md.user(
						user.slackId,
					)}. It looks as if you are ready for Level 3 where you can deposit/withdraw ${'pointdPal'.capitalizeFirstLetter()} Tokens!`,
				}),
				Blocks.Actions({}).elements(
					Elements.Button({
						text: 'Confirm',
						actionId: actions.wallet.level_up_confirm,
						value: ConfirmOrCancel.CONFIRM,
					}).primary(),
					Elements.Button({
						text: 'Cancel',
						actionId: actions.wallet.level_up_cancel,
						value: ConfirmOrCancel.CANCEL,
					}).danger(),
				),
			)
			.asUser();

		await say({ blocks: theBlocks.getBlocks() });
		return;
	}

	const leveledUpUser = await databaseService.updateAccountLevelToTwo(user);
	logger.debug('DB results', leveledUpUser);

	await say(
		`${Md.user(
			user.slackId,
		)}, we are going to level up your account to Level 2! This means you will start getting ${'pointdPal'.capitalizeFirstLetter()} Tokens as well as points!`,
	);
	return;
}

async function levelUpToLevelThree({
	action,
	context,
	logger,
	ack,
	client,
}: AllMiddlewareArgs & SlackActionMiddlewareArgs & StringIndexed) {
	await ack();
	logger.debug('do some dang level up to three things!');
	await client.chat.postMessage({
		channel: context.userId!,
		text: `We aren't quite ready for level three but we will note your response and get back to you asap: ${action.type}`,
	});
}

async function botWalletCount({
	message,
	context,
	logger,
	say,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<'message'> & StringIndexed) {
	const _teamId = context.teamId!;
	const botToken = await botTokenService.find();
	if (!botToken) {
		return;
	}
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-expect-error
	// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
	logger.debug(`Get the bot wallet by user ${message.user.name}`, botToken);
	let gas;
	try {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
		gas = await tokenBuddy.getBalance(botToken.publicWalletAddress);
	} catch (e) {
		logger.error(e);
		await say(`An error occurred getting PointdPal's gas amount`);
	}
	logger.debug(
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-expect-error
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		`Get the bot wallet by user ${message.user.name}, ${_.pick(JSON.stringify(botToken), [
			'publicWalletAddress',
			'name',
			'token',
		])}`,
	);

	const theBlocks = Message({ channel: message.channel, text: `PointdPal Wallet:` })
		.blocks(
			Blocks.Section({ text: `PointdPal Token Wallet Info:` }),
			Blocks.Divider(),
			Blocks.Section({ text: `Public Wallet Address: ${botToken.publicWalletAddress}` }),
			Blocks.Section({ text: `Tokens In Wallet: ${botToken.token.toLocaleString()}` }),
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
			Blocks.Section(gas ? { text: `Gas Available: ${gas.toLocaleString()}` } : undefined),
		)
		.asUser();

	await say({ blocks: theBlocks.getBlocks() });
}
