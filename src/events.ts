import { Md } from 'slack-block-builder';

import { app } from '@/app';
import { eventBus, configService, installService, slackService } from '@/lib/services';
import {
	type PPEvent,
	PPEventName,
	type PPFailureEvent,
	PPFailureEventName,
	type PPSpamEvent,
	PPSpamEventName,
} from '@/lib/types';
import { withNamespace } from '@/logger';

const logger = withNamespace('events');

eventBus.on(PPEventName, (eve: PPEvent) => {
	sendPlusPlusNotification(eve).catch((e) => {
		logger.error('There was an error when posting the `++` event to the notifications room', (e as Error).message);
	});
});
eventBus.on(PPFailureEventName, (eve: PPFailureEvent) => {
	sendPlusPlusFalsePositiveNotification(eve).catch((e) => {
		logger.error('There was an error when posting the `++` event to the notifications room', (e as Error).message);
	});
});
eventBus.on(PPSpamEventName, (eve: PPSpamEvent) => {
	logAndNotifySpam(eve).catch((e) => {
		logger.error('There was an error when posting the `++` event to the notifications room', (e as Error).message);
	});
});

async function sendPlusPlusNotification(ppEvent: PPEvent) {
	const config = await configService.getOrCreate(ppEvent.teamId);
	if (!config?.notificationChannel) {
		return;
	}
	const teamInstallConfig = await installService.findOne(ppEvent.teamId);
	if (!teamInstallConfig?.installation.bot?.token) {
		return;
	}
	const botToken = teamInstallConfig.installation.bot.token;
	const channelId = await slackService.getOrCreateConversation(botToken, ppEvent.teamId, config.notificationChannel);
	if (!channelId) {
		return;
	}

	const permalink = await slackService.getPermalinkToMessage(botToken, ppEvent.channel, ppEvent.originalMessageTs);
	if (permalink) {
		ppEvent.notificationMessage = `${ppEvent.notificationMessage} ${Md.link(permalink, 'view here')}`;
	}

	try {
		await app.client.chat.postMessage({
			token: botToken,
			channel: channelId,
			text: ppEvent.notificationMessage,
			attachments: [],
		});
	} catch (e: unknown) {
		logger.error('There was an error when posting the `++` event to the notifications room', (e as Error).message);
	}
}

async function sendPlusPlusFalsePositiveNotification(ppEvent: PPFailureEvent) {
	const config = await configService.getOrCreate(ppEvent.teamId);

	if (!config?.falsePositiveChannel) {
		return;
	}
	const teamInstallConfig = await installService.findOne(ppEvent.teamId);

	if (!teamInstallConfig?.installation.bot?.token) {
		return;
	}
	const botToken = teamInstallConfig.installation.bot.token;
	const channelId = await slackService.getOrCreateConversation(botToken, ppEvent.teamId, config.falsePositiveChannel);
	if (!channelId) {
		return;
	}

	try {
		await app.client.chat.postMessage({
			token: botToken,
			channel: channelId,
			text: ppEvent.notificationMessage,
		});
	} catch (e: unknown) {
		logger.error('There was an error when posting the `++` event to the notifications room', (e as Error).message);
	}
}

async function logAndNotifySpam({ sender, notificationMessage, reason, teamId }: PPSpamEvent) {
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
		await app.client.chat.postMessage({
			token: botToken,
			channel: sender.slackId,
			text: spamMessage,
		});
	} catch (e: unknown) {
		logger.error('There was an error when posting the `++` event to the notifications room', (e as Error).message);
	}
}
