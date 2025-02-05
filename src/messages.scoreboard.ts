import { format } from 'date-fns';
import ImageCharts from 'image-charts';
import { sampleSize, map, take } from 'lodash';
import { Blocks, Md, Message } from 'slack-block-builder';

import { app } from '@/app';
import { IUser } from '@/entities/user';
import { regExpCreator } from '@/lib/regexpCreator';
import * as scoreboardService from '@/lib/services/scoreboardService';
import * as userService from '@/lib/services/userService';
import {
	AllMiddlewareArgs,
	directMention,
	EventTypePattern,
	SlackEventMiddlewareArgs,
	StringIndexed,
} from '@slack/bolt';
import { ChatPostMessageArguments } from '@slack/web-api';

import { SlackMessage } from './lib/slackMessage';

app.message(regExpCreator.createAskForScoreRegExp(), directMention, respondWithScore);
app.message(regExpCreator.createTopBottomRegExp(), directMention, respondWithLeaderLoserBoard);
app.message(regExpCreator.createTopBottomTokenRegExp(), directMention, respondWithLeaderLoserTokenBoard);
app.message(regExpCreator.createTopPointGiversRegExp(), directMention, getTopPointSenders);

async function respondWithScore({
	message,
	context,
	logger,
	say,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<'message'> & StringIndexed) {
	logger.debug('respond with the score');

	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
	const { userId } = context.matches.groups;
	const teamId = context.teamId!;
	const user: IUser = await userService.findOneBySlackIdOrCreate(teamId, userId as string);

	let tokenString = '.';
	if (user.accountLevel > 1) {
		const partialTokenStr = `${user.pointdPalToken} PointdPal ${'Token'.pluralize(user.pointdPalToken)}`;
		tokenString = ` (${Md.bold(partialTokenStr)}).`;
	}

	let baseString = `${Md.user(user.slackId)} has ${Md.bold('point'.pluralize(user.score, true))}${tokenString}`;
	baseString += `\n${Md.italic('Account Level')}: ${user.accountLevel}`;
	baseString += `\n${Md.italic('Total Points Given')}: ${user.totalPointsGiven}`;
	if (user.pointdPalDay) {
		const dateObj = new Date(user.pointdPalDay);
		baseString += `\n:birthday: ${Md.bold('Pointd Pal day')} is ${Md.bold(format(dateObj, 'MM-DD-yyyy'))}`;
	}

	let reasonsStr = '';
	// get all reasons and put them in a keys array
	const keys: string[] = Array.from(user.reasons.keys());

	logger.debug('all the keys!', user.reasons.keys(), keys);
	if (keys.length > 0) {
		// get n unique random reasons and their scores
		const maxReasons = keys.length >= 5 ? 5 : keys.length;
		const sampleReasons = sampleSize(user.reasons, maxReasons);

		const reasonMessageArray: string[] = [];
		sampleReasons.forEach((points, reason) => {
			reasonMessageArray.push(`_${reason}_: ${'point'.pluralize(points, true)}`);
		});

		reasonsStr = `\n\n:star: Here are some reasons :star:\n${reasonMessageArray.join('\n')}`;
	}

	const sayArgs = SlackMessage.getSayMessageArgs(message, `${baseString}${reasonsStr}`);
	const sayResponse = await say(sayArgs);
}

async function respondWithLeaderLoserBoard({
	client,
	message,
	context,
	logger,
	_say,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<'message'> & StringIndexed & EventTypePattern) {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
	const { topOrBottom, digits }: { topOrBottom: string; digits: number } = context.matches.groups;
	const teamId = context.teamId as string;
	const topOrBottomString = topOrBottom.capitalizeFirstLetter();
	const methodName = `get${topOrBottomString}Scores`;
	const tops = await scoreboardService[methodName](teamId, digits);

	const messages: string[] = [];
	if (tops.length > 0) {
		for (let i = 0, end = tops.length - 1, asc = end >= 0; asc ? i <= end : i >= end; asc ? i++ : i--) {
			if (tops[i].accountLevel && tops[i].accountLevel > 1) {
				const tokenStr = tops[i].pointdPalToken > 1 ? 'Tokens' : 'Token';
				messages.push(
					`${i + 1}. ${Md.user(tops[i].slackId)}: ${tops[i].score} (*${
						tops[i].pointdPalToken
					} ${'pointdPal'.capitalizeFirstLetter()} ${tokenStr}*)`,
				);
			} else {
				messages.push(`${i + 1}. ${Md.user(tops[i].slackId)}: ${tops[i].score}`);
			}
		}
	} else {
		messages.push('No scores to keep track of yet!');
	}

	const chartText = `PointdPal ${topOrBottomString} ${digits} Score(s)`;
	const graphSize = Math.min(tops.length, Math.min(digits, 20));
	const topNNames = take(map(tops, 'name'), graphSize).join('|');
	const topNScores = take(map(tops, 'scores'), graphSize).join(',');
	const chartUrl = new ImageCharts()
		.cht('bvg')
		.chs('999x200')
		.chtt(chartText)
		.chxt('x,y')
		.chxl(`0:|${topNNames}`)
		.chd(`a:${topNScores}`)
		.toURL();

	const theMessage = Message({ channel: message.channel, text: chartText })
		.blocks(
			Blocks.Header({ text: chartText }),
			Blocks.Image({ imageUrl: chartUrl, altText: chartText }),
			Blocks.Section({ text: messages.join('\n') }),
		)
		.asUser();

	try {
		await client.chat.postMessage(theMessage.buildToObject() as ChatPostMessageArguments);
	} catch (e: unknown) {
		logger.error('error', e, theMessage.printPreviewUrl());
	}
}

async function respondWithLeaderLoserTokenBoard({
	message,
	context,
	client,
	logger,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<'message'> & StringIndexed) {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
	const { topOrBottom, digits }: { topOrBottom: string; digits: number } = context.matches.groups;
	const teamId = context.teamId as string;
	const topOrBottomString = topOrBottom.capitalizeFirstLetter();
	const methodName = `get${topOrBottomString}Tokens`;
	const tops = await scoreboardService[methodName](teamId, digits);

	const messages: string[] = [];
	if (tops.length > 0) {
		for (let i = 0, end = tops.length - 1, asc = end >= 0; asc ? i <= end : i >= end; asc ? i++ : i--) {
			const tokenStr = tops[i].pointdPalToken > 1 ? 'Tokens' : 'Token';
			const pointStr = tops[i].score > 1 ? 'points' : 'point';
			messages.push(
				`${i + 1}. ${Md.user(tops[i].slackId)}: *${tops[i].pointdPalToken} PointdPal ${tokenStr}* (${
					tops[i].score
				} ${pointStr})`,
			);
		}
	} else {
		messages.push('No scores to keep track of yet!');
	}

	const chartText = `PointdPal ${topOrBottomString} ${digits} Token(s)`;
	const graphSize = Math.min(tops.length, Math.min(digits, 20));
	const topNNames = take(map(tops, 'name'), graphSize).join('|');
	const topNTokens = take(map(tops, 'pointdPalToken'), graphSize).join(',');
	const chartUrl = new ImageCharts()
		.cht('bvg')
		.chs('999x200')
		.chtt(chartText)
		.chxt('x,y')
		.chxl(`0:|${topNNames}`)
		.chd(`a:${topNTokens}`)
		.toURL();

	const theMessage = Message({ channel: message.channel, text: chartText })
		.blocks(
			Blocks.Header({ text: chartText }),
			Blocks.Image({ imageUrl: chartUrl, altText: chartText }),
			Blocks.Section({ text: messages.join('\n') }),
		)
		.asUser();

	try {
		await client.chat.postMessage(theMessage.buildToObject() as ChatPostMessageArguments);
	} catch (e: unknown) {
		logger.error('error', e, theMessage.printPreviewUrl());
	}
}

async function getTopPointSenders({
	message,
	context,
	client,
	logger,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<'message'> & StringIndexed) {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
	const { topOrBottom, digits }: { topOrBottom: string; digits: number } = context.matches.groups;
	const teamId = context.teamId as string;
	const topOrBottomString = topOrBottom.capitalizeFirstLetter();
	const methodName = `get${topOrBottomString}Sender`;
	const tops = await scoreboardService[methodName](teamId, digits);

	const messages: string[] = [];
	if (tops.length > 0) {
		for (let i = 0, end = tops.length - 1, asc = end >= 0; asc ? i <= end : i >= end; asc ? i++ : i--) {
			const pointStr = `${'point'.pluralize(tops[i].totalPointsGiven)} given`;
			messages.push(`${i + 1}. ${Md.user(tops[i].slackId)} (${tops[i].totalPointsGiven} ${pointStr})`);
		}
	} else {
		messages.push('No scores to keep track of yet!');
	}

	const graphSize = Math.min(tops.length, Math.min(digits, 20));
	const chartText = `${topOrBottomString} ${graphSize} PointdPal Point ${'Sender'.pluralize(graphSize)}`;
	const topNNames = take(map(tops, 'name'), graphSize).join('|');
	const topNPointsGiven = take(map(tops, 'totalPointsGiven'), graphSize).join(',');
	const chartUrl = new ImageCharts()
		.cht('bvg')
		.chs('999x200')
		.chtt(chartText)
		.chxt('x,y')
		.chxl(`0:|${topNNames}`)
		.chd(`a:${topNPointsGiven}`)
		.toURL();

	const theMessage = Message({ channel: message.channel, text: chartText })
		.blocks(
			Blocks.Header({ text: chartText }),
			Blocks.Image({ imageUrl: chartUrl, altText: chartText }),
			Blocks.Section({ text: messages.join('\n') }),
		)
		.asUser();

	try {
		await client.chat.postMessage(theMessage.buildToObject() as ChatPostMessageArguments);
	} catch (e: unknown) {
		logger.error('error', e, theMessage.printPreviewUrl());
	}
}
