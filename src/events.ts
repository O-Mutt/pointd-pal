import { Md } from 'slack-block-builder';

import { app } from '../app';
import { eventBus } from '@/lib/services/eventBus';
import * as configService from '@/lib/services/configService';
import * as installService from '@/lib/services/installService';
import * as slackService from '@/lib/services/slack';
import {
	PPEvent,
	PPEventName,
	PPFailureEvent,
	PPFailureEventName,
	PPSpamEvent,
	PPSpamEventName,
} from '@/lib/types/Events';

eventBus.on(PPEventName, sendPlusPlusNotification);
eventBus.on(PPFailureEventName, sendPlusPlusFalsePositiveNotification);
eventBus.on(PPSpamEventName, logAndNotifySpam);

async function sendPlusPlusNotification(ppEvent: PPEvent) {
	const config = await configService.findOneOrCreate(ppEvent.teamId);
	if (!config?.notificationRoom) {
		return;
	}
	const teamInstallConfig = await installService.findOne(ppEvent.teamId);
	if (!teamInstallConfig?.installation.bot?.token) {
		return;
	}
	const botToken = teamInstallConfig.installation.bot.token;
	const channelId = await slackService.findOrCreateConversation(botToken, ppEvent.teamId, config.notificationRoom);
	if (!channelId) {
		return;
	}

	const permalink = await getPermalinkToMessage(botToken, ppEvent.channel, ppEvent.originalMessageTs);
	if (permalink) {
		ppEvent.notificationMessage = `${ppEvent.notificationMessage} ${Md.link(permalink, 'view here')}`;
	}

	try {
		const result = await app.client.chat.postMessage({
			token: botToken,
			channel: channelId,
			text: ppEvent.notificationMessage,
			attachments: [],
		});
	} catch (error: any | unknown) {
		console.error('There was an error when posting the `++` event to the notifications room', error.message);
		// logger.error(error);
	}
}

async function sendPlusPlusFalsePositiveNotification(ppEvent: PPFailureEvent) {
	const config = await configService.findOneOrCreate(ppEvent.teamId);

	if (!config?.falsePositiveRoom) {
		return;
	}
	const teamInstallConfig = await installService.findOne(ppEvent.teamId);

	if (!teamInstallConfig?.installation.bot?.token) {
		return;
	}
	const botToken = teamInstallConfig.installation.bot.token;
	const channelId = await slackService.findOrCreateConversation(botToken, ppEvent.teamId, config.falsePositiveRoom);
	if (!channelId) {
		return;
	}

	try {
		const result = await app.client.chat.postMessage({
			token: botToken,
			channel: channelId,
			text: ppEvent.notificationMessage,
		});
	} catch (error) {
		// logger.error(error);
	}
}

async function logAndNotifySpam({ sender, recipient, notificationMessage, reason, teamId }: PPSpamEvent) {
	//Logger.error(`A spam event has been detected: ${notificationObject.message}. ${notificationObject.reason}`);
	if (!sender.slackId) {
		return;
	}
	const teamInstallConfig = await installService.findOne(teamId);
	if (!teamInstallConfig?.installation.bot?.token) {
		return;
	}
	const spamMessage = `${notificationMessage}\n\n${reason}`;
	const botToken = teamInstallConfig.installation.bot.token;

	try {
		const result = await app.client.chat.postMessage({
			token: botToken,
			channel: sender.slackId,
			text: spamMessage,
		});
	} catch (e: any | unknown) {
		console.error(e);
		// logger.error(error);
	}
}

async function getPermalinkToMessage(botToken, channelId, ts): Promise<string | undefined> {
	try {
		console.log('look up the permalink', channelId, ts);
		const { permalink } = await app.client.chat.getPermalink({
			token: botToken,
			channel: channelId,
			message_ts: ts,
		});
		return permalink;
	} catch (e: any | unknown) {
		console.error('There was an error getting the permalink', e.message);
	}
}
