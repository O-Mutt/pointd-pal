import { ChatPostMessageArguments } from '@slack/web-api';
import { CronJob } from 'cron';
import ImageCharts from 'image-charts';
import _ from 'lodash';
import { BlockBuilder, Blocks, Md, Message } from 'slack-block-builder';

import { app } from '../app';
import { Helpers as H } from '@/lib/helpers';
import { PointdPalConfig } from './entities/pointdPalConfig';
import { getConnection } from '@/lib/services/database';
import * as SlackService from '@/lib/services/slack';
import * as installService from '@/lib/services/installService';
import * as scoreboardService from '@/lib/services/scoreboardService';
import { StringUtil } from '@/lib/string';

(async () => {
	const allInstalls = await installService.findAll();

	for (const install of allInstalls) {
		const { monthlyScoreboardCron, monthlyScoreboardDayOfWeek } = procVars;
		const job = new CronJob(
			monthlyScoreboardCron,
			async () => {
				const teamId = install?.teamId;
				const botToken = install?.installation.bot?.token;
				if (!teamId || !botToken) {
					return;
				}
				const connection = await getConnection(teamId);
				const pointdPalConfig = await PointdPalConfig(connection).findOne().exec();
				if (!pointdPalConfig) {
					return;
				}
				const scoreboardRoom = pointdPalConfig.scoreboardRoom;
				const channelId = await SlackService.findOrCreateConversation(botToken, teamId, scoreboardRoom);
				if (!channelId) {
					return;
				}
				if (H.isScoreboardDayOfWeek(monthlyScoreboardDayOfWeek)) {
					//Logger.debug('running the cron job');

					let rank: number = 0;
					// Senders
					const topSenders = await scoreboardService.getTopSenderInDuration(connection, 10, 30);
					let messages: string[] = [];
					rank = 1;
					for (const sender of topSenders) {
						const pointStr = `point${H.getEsOnEndOfWord(sender.scoreChange)} given`;
						console.log(`Top room [i] ${JSON.stringify(topSenders)}[${rank}]`);
						messages.push(`${rank}. ${Md.user(sender._id)} (${sender.scoreChange} ${pointStr})`);
						rank++;
					}
					const topSenderBlocks = buildBlocks(`Top 10 PointdPal Point Senders`, topSenders, messages);

					// Recipients
					const topRecipients = await scoreboardService.getTopReceiverInDuration(connection, 10, 30);
					messages = [];
					rank = 1;
					for (const recipient of topRecipients) {
						const pointStr = `point${H.getEsOnEndOfWord(recipient.scoreChange)} received`;
						console.log(`Top room [i] ${JSON.stringify(topRecipients)}[${rank}]`);
						messages.push(`${rank}. ${Md.user(recipient._id)} (${recipient.scoreChange} ${pointStr})`);
						rank++;
					}
					const topRecipientBlocks = buildBlocks(`Top 10 PointdPal Point Recipients`, topRecipients, messages);

					// Channel
					const topRooms = await scoreboardService.getTopRoomInDuration(connection, 3, 30);
					messages = [];
					rank = 1;
					for (const room of topRooms) {
						console.log('find the room', room);
						const { channel } = await app.client.conversations.info({ token: botToken, channel: room._id });
						if (channel) {
							room.name = channel.name;
						}
						const pointStr = `point${StringUtil.pluralSuffix(room.scoreChange)} given`;
						console.log(`Top room [i] ${JSON.stringify(topRooms)}[${rank}]`);
						messages.push(`${rank}. ${Md.channel(room._id)} (${room.scoreChange} ${pointStr})`);
						rank++;
					}

					const topRoomBlocks = buildBlocks(`Top 3 PointdPal Point Channels`, topRooms, messages);
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
						const result = await app.client.chat.postMessage({
							token: botToken,
							...theMessage.buildToObject(),
						} as ChatPostMessageArguments);
					} catch (e: any) {
						console.error('error', e, theMessage.printPreviewUrl());
					}
				}
			},
			null,
			true,
			'America/Chicago',
		);
		job.start();
	}
})();

function buildBlocks(title: string, tops: any[], messages: string[]) {
	const graphSize = Math.min(tops.length, Math.min(10, 20));
	const chartUrl = new ImageCharts()
		.cht('bvg')
		.chs('999x200')
		.chtt(title)
		.chxt('x,y')
		.chxl(`0:|${_.take(_.map(tops, 'name'), graphSize).join('|')}`)
		.chd(`a:${_.take(_.map(tops, 'scoreChange'), graphSize).join(',')}`)
		.toURL();

	const blocks: Appendable<BlockBuilder> = [
		Blocks.Section({ text: Md.bold(Md.italic(title)) }),
		Blocks.Image({ imageUrl: chartUrl, altText: title }),
		Blocks.Section({ text: messages.join('\n') }),
	];
	return blocks;
}
