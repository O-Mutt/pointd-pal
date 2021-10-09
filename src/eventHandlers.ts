import { Helpers } from './lib/helpers';
import { app } from '../app';

(() => {
const procVars = Helpers.getProcessVariables(process.env);

app.event('plus-plus', sendPlusPlusNotification);
app.event('plus-plus-failure', sendPlusPlusFalsePositiveNotification);
app.event('plus-plus-spam', logAndNotifySpam);

async function sendPlusPlusNotification({ event, client, logger }) {
  if (procVars.notificationsRoom) {
    try { 
      const result = await client.chat.postMessage({
        channel: procVars.notificationsRoom, 
        text: event.notificationMessage
      });
    } catch (error){
      logger.error(error);
    }
  }
}

async function sendPlusPlusFalsePositiveNotification({ event, client, logger }) {
  if (procVars.falsePositiveNotificationsRoom) {
    //robot.messageRoom(procVars.falsePositiveNotificationsRoom, notificationObject.notificationMessage);
    try { 
      const result = await client.chat.postMessage({
        channel: procVars.notificationsRoom, 
        text: event.notificationMessage
      });
    } catch (error){
      logger.error(error);
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
  //robot.messageRoom(notificationObject.from.id, `${notificationObject.message}\n\n${notificationObject.reason}`);
  try { 
    const result = await client.chat.postMessage({
      channel: procVars.notificationsRoom, 
      text: `${event.message}\n\n${event.reason}`
    });
  } catch (error){
    logger.error(error);
  }
}
})();