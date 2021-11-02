import { Blocks, Elements, Md, Message } from 'slack-block-builder';

import { ChatPostEphemeralArguments } from '@slack/web-api';

import { app } from '../app';
import { Installation } from './lib/models/installation';
import { QraftyConfig } from './lib/models/qraftyConfig';
import { BonuslyService } from './lib/services/bonusly';
import { connectionFactory } from './lib/services/connectionsFactory';
import { eventBus } from './lib/services/eventBus';
import { actions } from './lib/types/Actions';
import { ConfirmOrCancel, PromptSettings } from './lib/types/Enums';
import {
  PlusPlus, PlusPlusBonusly, PlusPlusBonuslyEventName, PlusPlusEventName, PlusPlusFailure, PlusPlusFailureEventName
} from './lib/types/Events';

eventBus.on(PlusPlusEventName, sendBonuslyBonus);
eventBus.on(PlusPlusBonuslyEventName, handleBonuslySent);

async function sendBonuslyBonus(plusPlusEvent: PlusPlus) {
  console.log('Handle plusplus for bonusly')
  const connection = connectionFactory(plusPlusEvent.teamId);
  const config = await QraftyConfig(connection).findOneOrCreate(plusPlusEvent.teamId);
  const teamInstallConfig = await Installation.findOne({ teamId: plusPlusEvent.teamId }).exec();
  if (!config.bonuslyConfig?.enabled || !config.bonuslyConfig?.apiKey || !config.bonuslyConfig?.url) {
    console.warn(`one of the configs is disabled Enabled [${config.bonuslyConfig?.enabled}] apiKey[${config.bonuslyConfig?.apiKey}] url[${config.bonuslyConfig?.url}]`);
    return;
  }

  const token = teamInstallConfig?.installation.bot?.token;
  if (!token) {
    console.warn(`This install is missing the bot token, apparently...`);
    return;
  }

  if (plusPlusEvent.sender.isBot === true) {
    // bots can't send ++ let alone bonusly bonuses
    console.error('How is a bot trying to send points?', plusPlusEvent.sender);
    return;
  }
  if (plusPlusEvent.sender.slackId && !plusPlusEvent.sender.email) {
    console.log('sender email missing but has slackId', plusPlusEvent.sender);
    const failureEvent = new PlusPlusFailure({
      notificationMessage: `${Md.user(plusPlusEvent.sender.slackId)} is trying to send a bonusly but their email is missing in ${Md.channel(plusPlusEvent.channel as string)}`,
      sender: plusPlusEvent.sender,
      channel: plusPlusEvent.channel,
      teamId: plusPlusEvent.teamId
    })
    eventBus.emit(PlusPlusFailureEventName, failureEvent);
    return;
  }

  const filteredRecipients = plusPlusEvent.recipients.filter((recipient) => recipient.isBot !== true && recipient.email);

  if (filteredRecipients && filteredRecipients.length < 1) {
    console.error('No recipients found', plusPlusEvent.recipients.map((rec) => rec.name).join(', '));
    // no recipients have emails to receive bonusly bonuses
    return;
  }

  console.log('Before the switch, ', plusPlusEvent.sender.bonuslyPrompt);
  switch (plusPlusEvent.sender.bonuslyPrompt) {
    case PromptSettings.ALWAYS: {
      console.log('Prompt settings, always send');
      const responses: any[] | undefined = await BonuslyService.sendBonus(plusPlusEvent.teamId, plusPlusEvent.sender, plusPlusEvent.recipients, plusPlusEvent.amount, plusPlusEvent.reason);
      if (!responses || responses.length < 1) {
        try {
          const result = await app.client.chat.postEphemeral({
            text: `${Md.emoji('thumbsdown')} Bonusly sending failed.`,
            token: token,
            user: plusPlusEvent.sender.slackId
          } as ChatPostEphemeralArguments);
        } catch (e) {
          console.log(e);
        }
        return;
      }
      const ppBonusly = new PlusPlusBonusly({
        responses,
        plusPlusEvent,
        sender: plusPlusEvent.sender
      })
      eventBus.emit(PlusPlusBonuslyEventName, ppBonusly);
      break;
    }
    case PromptSettings.PROMPT: {
      console.log('Prompt settings, prompt');
      const bonuslyAmount: number = plusPlusEvent.sender.bonuslyScoreOverride || plusPlusEvent.amount;
      console.log("prompt stringify", JSON.stringify({ ...plusPlusEvent, amount: bonuslyAmount }));
      const totalBonuslyPoints: number = bonuslyAmount * plusPlusEvent.recipients.length;
      const totalQraftyPoints: number = plusPlusEvent.amount * plusPlusEvent.recipients.length;
      const recipientSlackIds = plusPlusEvent.recipients.map((recipient) => Md.user(recipient.slackId)).join(', ');
      const message = Message({ text: `Should we include ${bonuslyAmount} bonusly points with your Qrafty points?`, channel: plusPlusEvent.channel })
        .blocks(
          Blocks.Header({ text: `Should we include ${bonuslyAmount} Bonusly points (per recipient), ${totalBonuslyPoints} total, with your Qrafty points?` }),
          Blocks.Section({
            text: `You are sending ${plusPlusEvent.amount} Qrafty Points (per recipient), ${totalQraftyPoints} total, to ${recipientSlackIds
              }. Would you like to include ${bonuslyAmount} per user, ${totalBonuslyPoints} total, bonusly bonus with these?`
          }),
          Blocks.Actions().elements(
            Elements.Button({ text: ConfirmOrCancel.CONFIRM, actionId: actions.bonusly.prompt_confirm, value: JSON.stringify({ ...plusPlusEvent, amount: bonuslyAmount }) }),
            Elements.Button({ text: ConfirmOrCancel.CANCEL, actionId: actions.bonusly.prompt_cancel })
          )
        )
        .ephemeral(true)
        .asUser();

      try {
        const result = await app.client.chat.postEphemeral({
          ...message.buildToObject(),
          token: token,
          user: plusPlusEvent.sender.slackId
        } as ChatPostEphemeralArguments);
      } catch (e) {
        console.error(e, message.printPreviewUrl());
      }
      break;
    }
    case PromptSettings.NEVER:
      console.log('Prompt settings, never');
    default:
      console.log('Prompt settings, default fall through');
      break;
  }
}


async function handleBonuslySent(plusPlusBonuslyEvent: PlusPlusBonusly) {
  const messages: string[] = [];
  const dms: string[] = [];
  console.log("This is the handle bonusly sent: ", plusPlusBonuslyEvent);
  const teamInstallConfig = await Installation.findOne({ teamId: plusPlusBonuslyEvent.plusPlusEvent.teamId }).exec();
  if (!teamInstallConfig?.installation.bot?.token) {
    return;
  }
  const token = teamInstallConfig.installation.bot.token;
  for (let i = 0; i < plusPlusBonuslyEvent.responses.length; i++) {
    if (plusPlusBonuslyEvent.responses[i].success === true) {
      messages.push(`We sent a Bonusly for ${plusPlusBonuslyEvent.responses[i].result.amount_with_currency} to ${Md.user(plusPlusBonuslyEvent.plusPlusEvent.recipients[i].slackId)}.`);
      // logger.debug('bonusly point was sent and we caught the event.');
      dms.push(`We sent ${Md.user(plusPlusBonuslyEvent.plusPlusEvent.recipients[i].slackId)} ${plusPlusBonuslyEvent.responses[i].result.amount_with_currency} via Bonusly. You now have ${plusPlusBonuslyEvent.responses[i].result.giver.giving_balance_with_currency} left.`);
    } else {
      // logger.error('there was an issue sending a bonus', e.response.message);
      messages.push(`Sorry, there was an issue sending your bonusly bonus: ${plusPlusBonuslyEvent.responses[i].message}`);
    }

    if (plusPlusBonuslyEvent.sender.bonuslyPointsDM) {
      try {
        await app.client.chat.postMessage({
          token: token,
          channel: plusPlusBonuslyEvent.plusPlusEvent.sender.slackId,
          text: dms.join('\n'),
        });
      } catch (e) {
        // logger.error('error sending dm for bonus', e)
      }
    }

    try {
      await app.client.chat.update({
        token: token,
        ts: plusPlusBonuslyEvent.plusPlusEvent.originalMessageTs,
        channel: plusPlusBonuslyEvent.plusPlusEvent.channel,
        text: `${plusPlusBonuslyEvent.plusPlusEvent.originalMessage}\n*Bonusly:*\n${messages.join('\n')}`,
      });
    } catch (e) {
      // logger.error('error sending dm for bonus', e)
    }
  }
}