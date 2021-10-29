import { Blocks, Elements, Md, Message } from 'slack-block-builder';

import { QraftyConfig } from './lib/models/qraftyConfig';
import { IUser, User } from './lib/models/user';
import { connectionFactory } from './lib/services/connectionsFactory';
import { BonuslyService } from './lib/services/bonusly';
import { eventBus } from './lib/services/eventBus';
import { ConfirmOrCancel, PromptSettings } from './lib/types/Enums';
import {
  PlusPlus, PlusPlusBonuslyEventName, PlusPlusEventName, PlusPlusFailure, PlusPlusFailureEventName
} from './lib/types/Events';
import { app } from '../app';
import { actions } from './lib/types/Actions';
import { ChatPostEphemeralArguments, ChatPostMessageArguments } from '@slack/web-api';

eventBus.on(PlusPlusEventName, sendBonuslyBonus);
eventBus.on(PlusPlusBonuslyEventName, handleBonuslySent);

async function sendBonuslyBonus(plusPlusEvent: PlusPlus) {
  console.log("send bonusly bonus");
  const connection = connectionFactory(plusPlusEvent.teamId);
  const config = await QraftyConfig(connection).findOneOrCreate(plusPlusEvent.teamId);
  const sender = await User(connection).findOneBySlackIdOrCreate(plusPlusEvent.sender.slackId);
  if (!config.bonuslyConfig?.enabled || !config.bonuslyConfig?.apiKey || !config.bonuslyConfig?.url) {
    return;
  }
  if (plusPlusEvent.sender.isBot === true) {
    // bots can't send ++ let alone bonusly bonuses
    return;
  }
  if (plusPlusEvent.sender.slackId && !plusPlusEvent.sender.email) {
    const failureEvent = new PlusPlusFailure({
      notificationMessage: `${Md.user(plusPlusEvent.sender.slackId)} is trying to send a bonusly but their email is missing in ${Md.channel(plusPlusEvent.channel as string)}`,
      sender: plusPlusEvent.sender,
      channel: plusPlusEvent.channel,
      teamId: plusPlusEvent.teamId
    })
    eventBus.emit(PlusPlusFailureEventName, failureEvent);
    return;
  }

  const bots = plusPlusEvent.recipients.filter((recipient) => recipient.isBot === true);
  const missingEmail = plusPlusEvent.recipients.filter((recipient) => !recipient.email);
  const filteredRecipients = plusPlusEvent.recipients.filter((recipient) => recipient.isBot !== true && recipient.email);

  if (filteredRecipients && filteredRecipients.length < 1) {
    // no recipients have emails to receive bonusly bonuses
    return;
  }

  switch (sender.bonuslyPrompt) {
    case PromptSettings.ALWAYS: {
      const responses: any[] = await BonuslyService.sendBonus(plusPlusEvent.teamId, plusPlusEvent.sender, plusPlusEvent.recipients, plusPlusEvent.amount, plusPlusEvent.reason);
      eventBus.emit(PlusPlusBonuslyEventName, { responses, plusPlusEvent, sender });
      break;
    }
    case PromptSettings.PROMPT: {
      const bonuslyAmount: number = sender.bonuslyScoreOverride || plusPlusEvent.amount;
      const totalBonuslyPoints: number = bonuslyAmount * plusPlusEvent.recipients.length;
      const totalQraftyPoints: number = plusPlusEvent.amount * plusPlusEvent.recipients.length;
      const message = Message({ text: `Should we include ${bonuslyAmount} bonusly points with your Qrafty points?`, channel: plusPlusEvent.channel })
        .blocks(
          Blocks.Header({ text: `Should we include ${bonuslyAmount} Bonusly points (per recipient), ${totalBonuslyPoints} total, with your Qrafty points?` }),
          Blocks.Section({ text: `You are sending ${plusPlusEvent.amount} Qrafty Points (per recipient), ${totalQraftyPoints} total, to ${plusPlusEvent.recipients.map((recipient) => Md.user(recipient.slackId)).join(', ')}. Would you like to include ${bonuslyAmount} per user, ${totalBonuslyPoints} total, bonusly bonus with these?` }),
          Blocks.Actions().elements(
            Elements.Button({ text: ConfirmOrCancel.CONFIRM, actionId: actions.bonusly.prompt_confirm, value: JSON.stringify(plusPlusEvent) }),
            Elements.Button({ text: ConfirmOrCancel.CANCEL, actionId: actions.bonusly.prompt_cancel, value: JSON.stringify(plusPlusEvent) })
          )
        )
        .ephemeral(true)
        .asUser()
        .buildToObject();

      try {
        const result = await app.client.chat.postEphemeral({ ...message, user: plusPlusEvent.sender.slackId } as ChatPostEphemeralArguments);
      } catch (e) {
        console.log(e);
      }
      break;
    }
    case PromptSettings.NEVER:
    default:
      break;
  }
}


async function handleBonuslySent(responses: any[], plusPlusEvent: PlusPlus, sender: IUser) {
  const messages: string[] = [];
  const dms: string[] = [];
  for (let i = 0; i < responses.length; i++) {
    if (responses[i].success === true) {
      messages.push(`We sent a Bonusly for ${responses[i].result.amount_with_currency} to ${Md.user(plusPlusEvent.recipients[i].slackId)}.`);
      // logger.debug('bonusly point was sent and we caught the event.');
      dms.push(`We sent ${Md.user(plusPlusEvent.recipients[i].slackId)} ${responses[i].result.amount_with_currency} via Bonusly. You now have ${responses[i].result.giver.giving_balance_with_currency} left.`);
    } else {
      // logger.error('there was an issue sending a bonus', e.response.message);
      messages.push(`Sorry, there was an issue sending your bonusly bonus: ${responses[i].message}`);
    }

    if (sender.bonuslyPointsDMResponse) {
      try {
        await app.client.chat.postMessage({
          channel: plusPlusEvent.sender.slackId,
          text: dms.join('\n'),
        });
      } catch (e) {
        // logger.error('error sending dm for bonus', e)
      }
    }

    try {
      await app.client.chat.postMessage({
        channel: plusPlusEvent.channel,
        text: messages.join('\n'),
      });
    } catch (e) {
      // logger.error('error sending dm for bonus', e)
    }
  }
}