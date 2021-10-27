import { app } from '../app';
import { QraftyConfig } from './lib/models/qraftyConfig';
import { connectionFactory } from './lib/services/connectionsFactory';
import { eventBus } from './lib/services/eventBus';
import { SlackService } from './lib/services/slack';
import {
  PlusPlus, PlusPlusEventName, PlusPlusFailure, PlusPlusFailureEventName, PlusPlusSpam,
  PlusPlusSpamEventName
} from './lib/types/PlusPlusEvents';

eventBus.on(PlusPlusEventName, sendPlusPlusNotification);
eventBus.on(PlusPlusFailureEventName, sendPlusPlusFalsePositiveNotification);
eventBus.on(PlusPlusSpamEventName, logAndNotifySpam);

async function sendPlusPlusNotification(plusPlusEvent: PlusPlus) {
  const config = await QraftyConfig(connectionFactory(plusPlusEvent.teamId)).findOneOrCreate(plusPlusEvent.teamId);
  if (!config?.notificationRoom) {
    return;
  }
  const channelId = await SlackService.findOrCreateConversation(plusPlusEvent.teamId, config?.notificationRoom);
  if (!channelId) {
    return;
  }
  try {
    const result = await app.client.chat.postMessage({
      channel: channelId,
      text: plusPlusEvent.notificationMessage,
    });
  } catch (error) {
    // logger.error(error);
  }
}

async function sendPlusPlusFalsePositiveNotification(plusPlusFailureEvent: PlusPlusFailure) {
  const config = await QraftyConfig(connectionFactory(plusPlusFailureEvent.teamId)).findOneOrCreate(plusPlusFailureEvent.teamId);
  if (!config?.falsePositiveRoom) {
    return;
  }
  const channelId = await SlackService.findOrCreateConversation(plusPlusFailureEvent.teamId, config?.falsePositiveRoom);
  if (!channelId) {
    return;
  }
  try {
    const result = await app.client.chat.postMessage({
      channel: channelId,
      text: plusPlusFailureEvent.notificationMessage,
    });
  } catch (error) {
    // logger.error(error);
  }
}

/**
 *
 * @param {object} notificationObject
 * @param {object} notificationObject.to the user object who was receiving the point
 * @param {object} notificationObject.from the user object who was sending the point
 * @param {string} notificationObject.message the message that should be sent to the user
 * @param {string} notificationObject.reason a reason why the message is being sent
 */
async function logAndNotifySpam({ to, from, message, reason }: PlusPlusSpam) {
  //Logger.error(`A spam event has been detected: ${notificationObject.message}. ${notificationObject.reason}`);
  //robot.messageRoom(notificationObject.from.slackId, `${notificationObject.message}\n\n${notificationObject.reason}`);
  try {
    if (from?.slackId) {
      const result = await app.client.chat.postMessage({
        channel: from.slackId,
        text: `${message}\n\n${reason}`,
      });
    }
  } catch (error) {
    // logger.error(error);
  }
}
