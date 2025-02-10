import { CronJob } from 'cron';
import ImageCharts from 'image-charts';
import { map, take } from 'lodash';
import { Blocks, Md, Message } from 'slack-block-builder';
import { type Appendable, type BlockBuilder } from 'slack-block-builder/dist/internal';

import { app } from '@/app';
import { type IInstallation } from '@/models/installation';
import { type IScoreLog } from '@/models/scoreLog';
import { DateExtensions } from '@/lib/dateExtensions';
import { configService } from '@/lib/services/configService';
import { scoreboardService } from '@/lib/services/scoreboardService';
import { slackService } from '@/lib/services/slack';
import { withNamespace } from '@/logger';
import config from '@config';
import { type ChatPostMessageArguments } from '@slack/web-api';

const logger = withNamespace('cron/job');

export function createCronJob(install: IInstallation) {
	return new CronJob(
		config.get('scoreboard.cron'),
		async () => {
			const teamId = install?.teamId;
			const botToken = install?.installation.bot?.token;
			if (!teamId || !botToken) {
				return;
			}

			const pointdPalConfig = await configService.findOneOrCreate(teamId);
			if (!pointdPalConfig) {
				return;
			}
			const scoreboardRoom = pointdPalConfig.scoreboardRoom;
			const channelId = await slackService.findOrCreateConversation(botToken, teamId, scoreboardRoom);
			if (!channelId) {
				return;
			}
			if (DateExtensions.isScoreboardDayOfWeek()) {
				logger.debug('running the cron job');

				let rank = 0;
				// Senders
				const topSenders = await scoreboardService.getTopSenderInDuration(teamId, 10, 30);
				let messages: string[] = [];
				rank = 1;
				for (const sender of topSenders) {
					const pointStr = `${'point'.pluralize(sender.sumOfScoreChange)} given`;
					logger.info(`Top room [i] ${JSON.stringify(topSenders)}[${rank}]`);
					messages.push(`${rank}. ${Md.user(sender.from)} (${sender.sumOfScoreChange} ${pointStr})`);
					rank++;
				}
				const topSenderBlocks = buildBlocks(
					`Top ${Math.max(topSenders.length, 10)} PointdPal Point Senders`,
					topSenders,
					messages,
				);

				// Recipients
				const topRecipients = await scoreboardService.getTopReceiverInDuration(teamId, 10, 30);
				messages = [];
				rank = 1;
				for (const recipient of topRecipients) {
					const pointStr = `${'point'.pluralize(recipient.sumOfScoreChange)} received`;
					logger.info(`Top room [i] ${JSON.stringify(topRecipients)}[${rank}]`);
					messages.push(`${rank}. ${Md.user(recipient.to)} (${recipient.sumOfScoreChange} ${pointStr})`);
					rank++;
				}
				const topRecipientBlocks = buildBlocks(
					`Top ${Math.max(topRecipients.length, 10)} PointdPal Point Recipients`,
					topRecipients,
					messages,
				);

				// Channel
				const topRooms = await scoreboardService.getTopRoomInDuration(teamId, 3, 30);
				messages = [];
				rank = 1;
				for (const room of topRooms) {
					logger.info('find the room', room);
					const { channel } = await app.client.conversations.info({ token: botToken, channel: room.channelId });
					if (channel) {
						room.channelName = channel.name;
					}
					const pointStr = `${'point'.pluralize(room.sumOfScoreChange)} given`;
					logger.info(`Top room [i] ${JSON.stringify(topRooms)}[${rank}]`);
					messages.push(`${rank}. ${Md.channel(room.channelId)} (${room.sumOfScoreChange} ${pointStr})`);
					rank++;
				}

				const topRoomBlocks = buildBlocks(
					`Top ${Math.min(topRooms.length, 3)} PointdPal Point Channels`,
					topRooms,
					messages,
				);
				const theMessage = Message({ channel: channelId, text: 'Monthly PointdPal Scoreboard' })
					.blocks(
						Blocks.Header({ text: 'Monthly PointdPal Scoreboard' }),
						Blocks.Divider(),
						...topSenderBlocks,
						Blocks.Divider(),
						...topRecipientBlocks,
						Blocks.Divider(),
						...topRoomBlocks,
					)
					.asUser();

				try {
					await app.client.chat.postMessage({
						token: botToken,
						...theMessage.buildToObject(),
					} as ChatPostMessageArguments);
				} catch (e) {
					logger.error('error', e, theMessage.printPreviewUrl());
				}
			}
		},
		null,
		true,
		'America/Chicago',
	);
}

function buildBlocks(
	title: string,
	tops: (Pick<IScoreLog, 'from' & 'to' & 'channelId'> & {
		sumOfScoreChange: number;
	})[],
	messages: string[],
) {
	const graphSize = Math.min(tops.length, Math.min(10, 20));
	const topN = take(map(tops, 'from') ?? map(tops, 'to') ?? map(tops, 'channelId'), graphSize).join('|');
	const topNPointsGiven: string = take(map(tops, 'sumOfScoreChange'), graphSize).join(',');
	const chartUrl = new ImageCharts()
		.cht('bvg')
		.chs('999x200')
		.chtt(title)
		.chxt('x,y')
		.chxl(`0:|${topN}`)
		.chd(`a:${topNPointsGiven}`)
		.toURL();

	const blocks: Appendable<BlockBuilder> = [
		Blocks.Section({ text: Md.bold(Md.italic(title)) }),
		Blocks.Image({ imageUrl: chartUrl, altText: title }),
		Blocks.Section({ text: messages.join('\n') }),
	];
	return blocks;
}
