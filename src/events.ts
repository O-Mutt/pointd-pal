import { Md } from 'slack-block-builder';

import { app } from '../app';
import { Installation } from './lib/models/installation';
import { QraftyConfig } from './lib/models/qraftyConfig';
import { connectionFactory } from './lib/services/connectionsFactory';
import { eventBus } from './lib/services/eventBus';
import { SlackService } from './lib/services/slack';
import {
  PlusPlus, PlusPlusEventName, PlusPlusFailure, PlusPlusFailureEventName, PlusPlusSpam,
  PlusPlusSpamEventName
} from './lib/types/Events';

eventBus.on(PlusPlusEventName, sendPlusPlusNotification);
eventBus.on(PlusPlusFailureEventName, sendPlusPlusFalsePositiveNotification);
eventBus.on(PlusPlusSpamEventName, logAndNotifySpam);

async function sendPlusPlusNotification(plusPlusEvent: PlusPlus) {
  const config = await QraftyConfig(connectionFactory(plusPlusEvent.teamId)).findOneOrCreate(plusPlusEvent.teamId);
  if (!config?.notificationRoom) {
    return;
  }
  const teamInstallConfig = await Installation.findOne({ teamId: plusPlusEvent.teamId }).exec();
  if (!teamInstallConfig?.installation.bot?.token) {
    return;
  }
  const botToken = teamInstallConfig.installation.bot.token;
  const channelId = await SlackService.findOrCreateConversation(botToken, plusPlusEvent.teamId, config.notificationRoom);
  if (!channelId) {
    return;
  }
  try {
    const { permalink } = await app.client.chat.getPermalink({
      token: botToken,
      channel: channelId,
      message_ts: plusPlusEvent.originalMessageTs
    });
    if (permalink) {
      plusPlusEvent.notificationMessage = `${plusPlusEvent.notificationMessage} ${Md.link(permalink, 'view here')}`
    }
    const result = await app.client.chat.postMessage({
      token: botToken,
      channel: channelId,
      text: plusPlusEvent.notificationMessage,
    });

  } catch (error: any | unknown) {
    console.error('There was an error when posting the `++` event to the notifications room', error.message)
    // logger.error(error);
  }
}

async function sendPlusPlusFalsePositiveNotification(plusPlusFailureEvent: PlusPlusFailure) {
  const config = await QraftyConfig(connectionFactory(plusPlusFailureEvent.teamId)).findOneOrCreate(plusPlusFailureEvent.teamId);
  if (!config?.falsePositiveRoom) {
    return;
  }
  const teamInstallConfig = await Installation.findOne({ teamId: plusPlusFailureEvent.teamId }).exec();
  if (!teamInstallConfig?.installation.bot?.token) {
    return;
  }
  const botToken = teamInstallConfig.installation.bot.token;
  const channelId = await SlackService.findOrCreateConversation(botToken, plusPlusFailureEvent.teamId, config.falsePositiveRoom);
  if (!channelId) {
    return;
  }
  try {
    const result = await app.client.chat.postMessage({
      token: botToken,
      channel: channelId,
      text: plusPlusFailureEvent.notificationMessage,
    });
  } catch (error) {
    // logger.error(error);
  }
}

async function logAndNotifySpam({ sender, recipient, message, reason, teamId }: PlusPlusSpam) {
  //Logger.error(`A spam event has been detected: ${notificationObject.message}. ${notificationObject.reason}`);
  if (!sender.slackId) {
    return;
  }
  const teamInstallConfig = await Installation.findOne({ teamId: teamId }).exec();
  if (!teamInstallConfig?.installation.bot?.token) {
    return;
  }
  const botToken = teamInstallConfig.installation.bot.token;
  try {
    const result = await app.client.chat.postMessage({
      token: botToken,
      channel: sender.slackId,
      text: `${message}\n\n${reason}`,
    });
  } catch (e: any | unknown) {
    console.error(e)
    // logger.error(error);
  }
}
