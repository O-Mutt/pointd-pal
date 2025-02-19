import { CronJob } from 'cron';
import ImageCharts from 'image-charts';
import { map, take } from 'lodash';
import { Blocks, Md, Message } from 'slack-block-builder';
import { type Appendable, type BlockBuilder } from 'slack-block-builder/dist/internal';

import { app } from '@/app';
import { type IInstallation } from '@/models/installation';
import { type IScoreLog } from '@/models/scoreLog';
import { DateExtensions } from '@/lib/dateExtensions';
import { withNamespace } from '@/logger';
import config from '@config';
import { type ChatPostMessageArguments } from '@slack/web-api';
import type { CronWorkerEntry } from './types/CronWorkerEntry';
import { configService, scoreboardService, slackService } from '@/lib/services';

const logger = withNamespace('cron/job');

export async function createOrUpdateCronJob(install: IInstallation): Promise<CronWorkerEntry> {
	const teamId = install?.teamId;
	if (!teamId) {
		return Promise.reject(new Error('No team id found'));
	}
	let cron = config.get('scoreboard.cron');
	const installConfig = await configService.getOrCreate(install?.teamId);
	if (!installConfig) {
		logger.warn('No config found for team, not starting cron', install?.teamId);
	}

	if (installConfig.scoreboardCron) {
		cron = installConfig.scoreboardCron;
	}

	return {
		teamId,
		install,
		cron: new CronJob(
			cron,
			async () => {
				const teamId = install?.teamId;
				const botToken = install?.installation.bot?.token;
				if (!teamId || !botToken) {
					return;
				}

				const scoreboardChannel = installConfig.scoreboardChannel;
				if (!scoreboardChannel) {
					logger.warn('No scoreboard channel found for team, not running cron', teamId);
					return;
				}
				const channelId = await slackService.getOrCreateConversation(botToken, teamId, scoreboardChannel);
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
						`Top ${Math.max(topSenders.length, 10)} Pointd Point Senders`,
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
						`Top ${Math.max(topRecipients.length, 10)} Pointd Point Recipients`,
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
						`Top ${Math.min(topRooms.length, 3)} Pointd Point Channels`,
						topRooms,
						messages,
					);
					const theMessage = Message({ channel: channelId, text: 'Pointd Scoreboard' })
						.blocks(
							Blocks.Header({ text: 'Pointd Scoreboard' }),
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
			'UTC',
		),
	};
}

// TODO this should be abstracted a little to make building the hometabs/message scoreboards easier
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
