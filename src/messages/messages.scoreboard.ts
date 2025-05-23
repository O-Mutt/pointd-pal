import { format } from 'date-fns';
import ImageCharts from 'image-charts';
import { map, sampleSize, take } from 'lodash';
import { Blocks, Md, Message } from 'slack-block-builder';

import { type IUser } from '@/models/user';
import { scoreboardService } from '@/lib/services/scoreboardService';
import { userService } from '@/lib/services/userService';
import {
	type AllMiddlewareArgs,
	App,
	directMention,
	type SlackEventMiddlewareArgs,
	type StringIndexed,
} from '@slack/bolt';
import { type ChatPostMessageArguments } from '@slack/web-api';

import { SlackMessage } from '../lib/slackMessage';
import {
	askForUserScoreRegexp,
	bottomGiversRegexp,
	bottomRegexp,
	bottomTokensRegexp,
	topGiversRegexp,
	topRegexp,
	topTokensRegexp,
} from '../lib/messageMatchers';

export function registerScoreboard(app: App): void {
	app.message(askForUserScoreRegexp, directMention, respondWithScore);

	app.message(topRegexp, directMention, respondWithTopRecipientBoard);
	app.message(bottomRegexp, directMention, respondWithBottomRecipientBoard);

	app.message(topTokensRegexp, directMention, respondWithLeaderLoserTokenBoard);
	app.message(bottomTokensRegexp, directMention, respondWithLeaderLoserTokenBoard);

	app.message(topGiversRegexp, directMention, getTopPointSenders);
	app.message(bottomGiversRegexp, directMention, getBottomPointSenders);
}

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
	const user: IUser = await userService.getOrCreateBySlackId(teamId, userId as string);

	let tokenString = '.';
	if (user.accountLevel > 1) {
		const partialTokenStr = `${'PointdPal Token'.pluralize(user.token, true)}`;
		tokenString = ` (${Md.bold(partialTokenStr)}).`;
	}

	let baseString = `${Md.user(user.slackId)} has ${Md.bold('point'.pluralize(user.score, true))}${tokenString}`;
	baseString += `\n${Md.italic('Account Level')}: ${user.accountLevel}`;
	baseString += `\n${Md.italic('Total Points Given')}: ${user.totalPointsGiven}`;
	if (user.pointdPalDay) {
		const dateObj = new Date(user.pointdPalDay);
		baseString += `\n:birthday: ${Md.bold('Pointd Pal day')} is ${Md.bold(format(dateObj, 'MM-dd-yyyy'))}`;
	}

	let reasonsStr = '';
	// get all reasons and put them in a keys array
	const keys = Object.keys(user.reasons);

	logger.debug('all the keys!', Object.keys(user.reasons));
	if (keys.length > 0) {
		// get n unique random reasons and their scores
		const maxReasons = Math.min(keys.length, 5);
		const sampleReasons = sampleSize(Object.entries(user.reasons), maxReasons);

		const reasonMessageArray: string[] = [];
		sampleReasons.forEach(([reason, points]) => {
			reasonMessageArray.push(`_${reason}_: ${'point'.pluralize(points, true)}`);
		});

		reasonsStr = `\n\n:star: Here are some reasons :star:\n${reasonMessageArray.join('\n')}`;
	}

	const sayArgs = SlackMessage.getSayMessageArgs(message, `${baseString}${reasonsStr}`);
	await say(sayArgs);
}

async function respondWithTopRecipientBoard({
	client,
	message,
	context,
	logger,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<'message'> & StringIndexed) {
	logger.error('respond with leaderboard');
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
	const { digits }: { topOrBottom: string; digits: number } = context.matches.groups;
	const teamId = context.teamId as string;
	const tops = await scoreboardService.getTopScores(teamId, digits);

	logger.info('retrieved', digits, 'scores from db', tops);
	const messages: string[] = [];
	if (tops.length > 0) {
		for (let i = 0, end = tops.length - 1, asc = end >= 0; asc ? i <= end : i >= end; asc ? i++ : i--) {
			if (tops[i].accountLevel && tops[i].accountLevel > 1) {
				messages.push(
					`${i + 1}. ${Md.user(tops[i].slackId)}: ${tops[i].score} (*${
						tops[i].token
					} ${'pointdPal'.capitalizeFirstLetter()} ${'Token'.pluralize(tops[i].token)}*)`,
				);
			} else {
				messages.push(`${i + 1}. ${Md.user(tops[i].slackId)}: ${tops[i].score}`);
			}
		}
	} else {
		messages.push('No scores to keep track of yet!');
	}

	const graphSize = Math.min(tops.length, Math.min(digits, 20));
	const chartText = `PointdPal Top ${graphSize} ${'Score'.pluralize(graphSize)}`;
	const topNNames = take(map(tops, 'name'), graphSize).join('|');
	const topNScores = take(map(tops, 'score'), graphSize).join(',');
	logger.info('found top n scores and names', topNNames, topNScores);
	const chartUrl = new ImageCharts()
		.cht('bvg')
		.chs('999x300')
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

async function respondWithBottomRecipientBoard({
	client,
	message,
	context,
	logger,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<'message'> & StringIndexed) {
	logger.error('respond with leaderboard');
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
	const { digits }: { digits: number } = context.matches.groups;
	const teamId = context.teamId as string;
	const bottomRecipients = await scoreboardService.getBottomScores(teamId, digits);

	logger.info('retrieved', digits, 'scores from db', bottomRecipients);
	const messages: string[] = [];
	if (bottomRecipients.length > 0) {
		for (let i = 0, end = bottomRecipients.length - 1, asc = end >= 0; asc ? i <= end : i >= end; asc ? i++ : i--) {
			if (bottomRecipients[i].accountLevel && bottomRecipients[i].accountLevel > 1) {
				messages.push(
					`${i + 1}. ${Md.user(bottomRecipients[i].slackId)}: ${bottomRecipients[i].score} (*${
						bottomRecipients[i].token
					} ${'pointdPal'.capitalizeFirstLetter()} ${'Token'.pluralize(bottomRecipients[i].token)}*)`,
				);
			} else {
				messages.push(`${i + 1}. ${Md.user(bottomRecipients[i].slackId)}: ${bottomRecipients[i].score}`);
			}
		}
	} else {
		messages.push('No scores to keep track of yet!');
	}

	const graphSize = Math.min(bottomRecipients.length, Math.min(digits, 20));
	const chartText = `PointdPal Bottom ${graphSize} ${'Score'.pluralize(graphSize)}`;
	const bottomNNames = take(map(bottomRecipients, 'name'), graphSize).join('|');
	const bottomNScores = take(map(bottomRecipients, 'score'), graphSize).join(',');
	logger.info('found top n scores and names', bottomNNames, bottomNScores);
	const chartUrl = new ImageCharts()
		.cht('bvg')
		.chs('999x300')
		.chtt(chartText)
		.chxt('x,y')
		.chxl(`0:|${bottomNNames}`)
		.chd(`a:${bottomNScores}`)
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
		logger.error('error getting bottoms scores', e, theMessage.printPreviewUrl());
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
	const methodName = `get${topOrBottomString}Tokens` as 'getTopTokens' | 'getBottomTokens';
	const tops = await scoreboardService[methodName](teamId, digits);

	const messages: string[] = [];
	if (tops.length > 0) {
		for (let i = 0, end = tops.length - 1, asc = end >= 0; asc ? i <= end : i >= end; asc ? i++ : i--) {
			messages.push(
				`${i + 1}. ${Md.user(tops[i].slackId)}: *${tops[i].token} PointdPal ${'Token'.pluralize(tops[i].token)}* (${
					tops[i].score
				} ${'points'.pluralize(tops[i].score)})`,
			);
		}
	} else {
		messages.push('No scores to keep track of yet!');
	}

	const graphSize = Math.min(tops.length, Math.min(digits, 20));
	const chartText = `PointdPal ${topOrBottomString} ${graphSize} Token(s)`;
	const topNNames = take(map(tops, 'name'), graphSize).join('|');
	const topNTokens = take(map(tops, 'token'), graphSize).join(',');
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
	const { digits }: { digits: number } = context.matches.groups;
	const teamId = context.teamId as string;
	const tops = await scoreboardService.getTopSender(teamId, digits);

	const messages: string[] = [];
	if (tops.length > 0) {
		for (let i = 0, end = tops.length - 1, asc = end >= 0; asc ? i <= end : i >= end; asc ? i++ : i--) {
			const pointStr = `${'point'.pluralize(tops[i].totalPointsGiven)} given`;
			messages.push(`${i + 1}. ${Md.user(tops[i].slackId)} ${tops[i].totalPointsGiven} ${pointStr}`);
		}
	} else {
		messages.push('No scores to keep track of yet!');
	}

	const graphSize = Math.min(tops.length, Math.min(digits, 20));
	const chartText = `Top ${graphSize} Pointd Point ${'Sender'.pluralize(graphSize)}`;
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

async function getBottomPointSenders({
	message,
	context,
	client,
	logger,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<'message'> & StringIndexed) {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
	const { digits }: { digits: number } = context.matches.groups;
	const teamId = context.teamId as string;

	const tops = await scoreboardService.getBottomSender(teamId, digits);

	const messages: string[] = [];
	if (tops.length > 0) {
		for (let i = 0, end = tops.length - 1, asc = end >= 0; asc ? i <= end : i >= end; asc ? i++ : i--) {
			const pointStr = `${'point'.pluralize(tops[i].totalPointsGiven)} given`;
			messages.push(`${i + 1}. ${Md.user(tops[i].slackId)} ${tops[i].totalPointsGiven} ${pointStr}`);
		}
	} else {
		messages.push('No scores to keep track of yet!');
	}

	const graphSize = Math.min(tops.length, Math.min(digits, 20));
	const chartText = `Bottom ${graphSize} Pointd Point ${'Sender'.pluralize(graphSize)}`;
	const bottomNNames = take(map(tops, 'name'), graphSize).join('|');
	const bottomNPointsGiven = take(map(tops, 'totalPointsGiven'), graphSize).join(',');
	const chartUrl = new ImageCharts()
		.cht('bvg')
		.chs('999x200')
		.chtt(chartText)
		.chxt('x,y')
		.chxl(`0:|${bottomNNames}`)
		.chd(`a:${bottomNPointsGiven}`)
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
