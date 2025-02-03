import { sampleSize } from 'lodash.samplesize';
import { map } from 'lodash.map';
import { take } from 'lodash.take';
import ImageCharts from 'image-charts';
import { directMention } from '@slack/bolt';
import { format } from 'date-fns';

import { app } from '@/app';
import { regExpCreator } from '@/lib/regexpCreator';
import { Blocks, Md, Message } from 'slack-block-builder';
import { ChatPostMessageArguments } from '@slack/web-api';
import { IUser } from '@/entities/user';
import * as userService from '@/lib/services/userService';
import * as scoreboardService from '@/lib/services/scoreboardService';
import { SlackMessage } from './lib/slackMessage';

app.message(regExpCreator.createAskForScoreRegExp(), directMention, respondWithScore);
app.message(regExpCreator.createTopBottomRegExp(), directMention, respondWithLeaderLoserBoard);
app.message(regExpCreator.createTopBottomTokenRegExp(), directMention, respondWithLeaderLoserTokenBoard);
app.message(regExpCreator.createTopPointGiversRegExp(), directMention, getTopPointSenders);

async function respondWithScore({ message, context, logger, say }) {
	logger.debug('respond with the score');
	const { userId } = context.matches.groups;
	const teamId = context.teamId as string;
	const user: IUser = await userService.findOneBySlackIdOrCreate(teamId, userId);

	let tokenString = '.';
	if (user.accountLevel > 1) {
		const partialTokenStr = `${user.pointdPalToken} PointdPal ${'Token'.pluralize(user.pointdPalToken)}`;
		tokenString = ` (${Md.bold(partialTokenStr)}).`;
	}

	const pointStr = `${'point'.pluralize(user.score)}`;
	let baseString = `${Md.user(user.slackId)} has ${Md.bold(user.score.toString())} ${Md.bold(pointStr)}${tokenString}`;
	baseString += `\n${Md.italic('Account Level')}: ${user.accountLevel}`;
	baseString += `\n${Md.italic('Total Points Given')}: ${user.totalPointsGiven}`;
	if (user.pointdPalDay) {
		const dateObj = new Date(user.pointdPalDay);
		baseString += `\n:birthday: ${Md.bold('Pointd Pal day')} is ${Md.bold(format(dateObj, 'MM-DD-yyyy'))}`;
	}

	let reasonsStr: string = '';
	// get all reasons and put them in a keys array
	const keys: string[] = Array.from(user.reasons.keys());

	logger.debug('all the keys!', user.reasons.keys(), keys);
	if (keys.length > 0) {
		// get n unique random reasons and their scores
		const maxReasons = keys.length >= 5 ? 5 : keys.length;
		const sampleReasons = sampleSize(user.reasons, maxReasons);

		const reasonMessageArray: string[] = [];
		sampleReasons.forEach((points, reason) => {
			const pointStr = points > 1 ? 'points' : 'point';
			reasonMessageArray.push(`_${reason}_: ${points} ${pointStr}`);
		});

		reasonsStr = `\n\n:star: Here are some reasons :star:\n${reasonMessageArray.join('\n')}`;
	}

	const sayArgs = SlackMessage.getSayMessageArgs(message, `${baseString}${reasonsStr}`);
	const sayResponse = await say(sayArgs);
}

async function respondWithLeaderLoserBoard({ client, message, context, logger, say }) {
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
		const result = await client.chat.postMessage(theMessage.buildToObject() as ChatPostMessageArguments);
	} catch (e: any) {
		console.error('error', e, theMessage.printPreviewUrl());
	}
}

async function respondWithLeaderLoserTokenBoard({ message, context, client }) {
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
		const result = await client.chat.postMessage(theMessage.buildToObject() as ChatPostMessageArguments);
	} catch (e: any) {
		console.error('error', e, theMessage.printPreviewUrl());
	}
}

async function getTopPointSenders({ message, context, client }) {
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
		const result = await client.chat.postMessage(theMessage.buildToObject() as ChatPostMessageArguments);
	} catch (e: any) {
		console.error('error', e, theMessage.printPreviewUrl());
	}
}
