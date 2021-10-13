import { Helpers } from './lib/helpers';
import { app } from '../app';
import { EventEmitter } from 'events';
import { PlusPlus, PlusPlusEventName, PlusPlusFailure, PlusPlusFailureEventName, PlusPlusSpamEventName } from './lib/types/PlusPlusEvents';

const events = new EventEmitter();
const procVars = Helpers.getProcessVariables(process.env);

events.on(PlusPlusEventName, sendPlusPlusNotification);
events.on(PlusPlusFailureEventName, sendPlusPlusFalsePositiveNotification);
events.on(PlusPlusSpamEventName, logAndNotifySpam);

async function sendPlusPlusNotification({ notificationMessage, sender, recipient, direction, amount, channel, reason }: PlusPlus) {
  if (procVars.notificationsRoom) {
    try { 
      const result = await app.client.chat.postMessage({
        channel: procVars.notificationsRoom, 
        text: notificationMessage
      });
    } catch (error){
      //logger.error(error);
    }
  }
}

async function sendPlusPlusFalsePositiveNotification({ notificationMessage, channel }: PlusPlusFailure) {
  if (procVars.falsePositiveNotificationsRoom) {
    try { 
      const result = await app.client.chat.postMessage({
        channel: procVars.notificationsRoom, 
        text: notificationMessage
      });
    } catch (error){
      //logger.error(error);
    }
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
async function logAndNotifySpam({ event, client, logger }) {
  //Logger.error(`A spam event has been detected: ${notificationObject.message}. ${notificationObject.reason}`);
  //robot.messageRoom(notificationObject.from.slackId, `${notificationObject.message}\n\n${notificationObject.reason}`);
  try { 
    const result = await client.chat.postMessage({
      channel: procVars.notificationsRoom, 
      text: `${event.message}\n\n${event.reason}`
    });
  } catch (error){
    logger.error(error);
  }
}