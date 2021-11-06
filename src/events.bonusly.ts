import { Blocks, Elements, Md, Message } from 'slack-block-builder';

import { ChatPostEphemeralArguments, ChatPostEphemeralResponse, ChatUpdateArguments, ConversationsHistoryArguments, ConversationsRepliesArguments } from '@slack/web-api';

import { app } from '../app';
import { Installation } from './lib/models/installation';
import { QraftyConfig } from './lib/models/qraftyConfig';
import { BonuslyService } from './lib/services/bonusly';
import { connectionFactory } from './lib/services/connectionsFactory';
import { eventBus } from './lib/services/eventBus';
import { actions } from './lib/types/Actions';
import { ConfirmOrCancel, PromptSettings } from './lib/types/Enums';
import { PPBonuslySentEvent, PPBonuslySentEventName, PPEvent, PPEventName, PPFailureEvent, PPFailureEventName, TerseBonuslySentPayload } from './lib/types/Events';
import { Message as RepliesMessage } from '@slack/web-api/dist/response/ConversationsRepliesResponse';
import { Message as HistoryMessage } from '@slack/web-api/dist/response/ConversationsHistoryResponse';

eventBus.on(PPEventName, sendBonuslyBonus);
eventBus.on(PPBonuslySentEventName, handleBonuslySent);

async function sendBonuslyBonus(plusPlusEvent: PPEvent) {
  console.log('Caught plus plus event and will handle sending a bonusly')
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
    const failureEvent: PPFailureEvent = {
      notificationMessage: `${Md.user(plusPlusEvent.sender.slackId)} is trying to send a bonusly but their email is missing in ${Md.channel(plusPlusEvent.channel as string)}`,
      sender: plusPlusEvent.sender.slackId,
      recipients: plusPlusEvent.recipients.map((rec) => rec.slackId),
      channel: plusPlusEvent.channel,
      teamId: plusPlusEvent.teamId
    };
    eventBus.emit(PPFailureEventName, failureEvent);
    return;
  }

  const filteredRecipients = plusPlusEvent.recipients.filter((recipient) => recipient.isBot !== true && recipient.email);

  if (filteredRecipients && filteredRecipients.length < 1) {
    console.error('No recipients found', plusPlusEvent.recipients.map((rec) => rec.name).join(', '));
    // no recipients have emails to receive bonusly bonuses
    return;
  }

  const bonuslyAmount: number = plusPlusEvent.sender.bonuslyScoreOverride || plusPlusEvent.amount;
  const totalBonuslyPoints: number = bonuslyAmount * plusPlusEvent.recipients.length;
  const totalQraftyPoints: number = plusPlusEvent.amount * plusPlusEvent.recipients.length;
  const recipientSlackIds = plusPlusEvent.recipients.map((recipient) => Md.user(recipient.slackId)).join(', ');
  const bonuslyPayload = buildBonuslyPayload(plusPlusEvent, bonuslyAmount);
  console.log('Before the switch,', plusPlusEvent.sender.bonuslyPrompt);
  switch (plusPlusEvent.sender.bonuslyPrompt) {
    case PromptSettings.ALWAYS: {
      const bonuslyAmount: number = plusPlusEvent.sender.bonuslyScoreOverride || plusPlusEvent.amount;
      console.log('Prompt settings, always send');
      const responses: any[] | undefined = await BonuslyService.sendBonus(plusPlusEvent.teamId, plusPlusEvent.sender.email as string, plusPlusEvent.recipients.map(rec => rec.email as string), bonuslyAmount, plusPlusEvent.reason);
      if (!responses || responses.length < 1) {
        try {
          const result = await app.client.chat.postEphemeral({
            text: `${Md.emoji('thumbsdown')} Bonusly sending failed.`,
            token: token,
            user: plusPlusEvent.sender.slackId,
            channel: plusPlusEvent.channel
          } as ChatPostEphemeralArguments);
        } catch (e) {
          console.log("error posting ephemeral bonusly send fail", e);
        }
        return;
      }

      const ppBonusly: PPBonuslySentEvent = {
        responses,
        teamId: plusPlusEvent.teamId,
        channel: plusPlusEvent.channel,
        originalMessageTs: plusPlusEvent.originalMessageTs,
        originalMessageParentTs: plusPlusEvent.originalMessageParentTs,
        recipients: plusPlusEvent.recipients,
        sender: plusPlusEvent.sender
      };
      eventBus.emit(PPBonuslySentEventName, ppBonusly);
      break;
    }
    case PromptSettings.PROMPT: {
      console.log('Prompt settings, prompt');
      const message = Message({ text: `Should we include ${bonuslyAmount} bonusly points with your Qrafty points?`, channel: plusPlusEvent.channel })
        .blocks(
          Blocks.Header({ text: `Should we include ${bonuslyAmount} Bonusly points (per recipient), ${totalBonuslyPoints} total, with your Qrafty points?` }),
          Blocks.Section({
            text: `You are sending ${plusPlusEvent.amount} Qrafty Points (per recipient), ${totalQraftyPoints} total, to ${recipientSlackIds
              }. Would you like to include ${bonuslyAmount} per user, ${totalBonuslyPoints} total, bonusly bonus with these?`
          }),
          Blocks.Actions().elements(
            Elements.Button({ text: ConfirmOrCancel.CONFIRM, actionId: actions.bonusly.prompt_confirm, value: JSON.stringify(bonuslyPayload) }).primary(),
            Elements.Button({ text: ConfirmOrCancel.CANCEL, actionId: actions.bonusly.prompt_cancel })
          )
        )
        .ephemeral(true)
        .asUser();

      try {
        const postMessage: ChatPostEphemeralArguments = {
          ...message.buildToObject(),
          token: token,
          user: plusPlusEvent.sender.slackId,
        };
        if (plusPlusEvent.originalMessageParentTs) {
          postMessage.thread_ts = plusPlusEvent.originalMessageTs;
        }
        const result: ChatPostEphemeralResponse = await app.client.chat.postEphemeral(postMessage);

      } catch (e) {
        console.error("post for ephemeral", e, message.printPreviewUrl());
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


async function handleBonuslySent(event: PPBonuslySentEvent) {
  const bonuslyMessages: string[] = [];
  const dms: string[] = [];
  console.log("This is the handle bonusly sent: ", event);
  const teamInstallConfig = await Installation.findOne({ teamId: event.teamId }).exec();
  if (!teamInstallConfig?.installation.bot?.token) {
    return;
  }
  const token = teamInstallConfig.installation.bot.token;

  for (let i = 0; i < event.responses.length; i++) {
    if (event.responses[i].success === true) {
      bonuslyMessages.push(`We sent a Bonusly for ${event.responses[i].amount_with_currency
        } to ${Md.user(event.recipients[i].slackId)}.`);
      // logger.debug('bonusly point was sent and we caught the event.');
      dms.push(`We sent as Bonusly to ${Md.user(event.recipients[i].slackId)} for ${event.responses[i].amount_with_currency
        }. You now have ${event.responses[i].giving_balance_with_currency} left.`);
    } else {
      // logger.error('there was an issue sending a bonus', e.response.message);
      bonuslyMessages.push(`Sorry, there was an issue sending your bonusly to ${Md.user(event.recipients[i].slackId)}.`);
      dms.push(`Sorry, there was an issue sending your bonusly to ${Md.user(event.recipients[i].slackId)}: ${event.responses[i].message}`);
    }
  }

  if (event.sender.bonuslyPointsDM) {
    try {
      await app.client.chat.postMessage({
        token: token,
        channel: event.sender.slackId,
        text: dms.join('\n'),
      });
    } catch (e) {
      console.error('error sending dm for bonusly', e)
    }
  }

  let originalMessage: RepliesMessage | HistoryMessage | undefined = undefined;
  try {
    let messages: RepliesMessage[] | HistoryMessage[] | undefined = undefined;
    if (event.originalMessageParentTs) {
      const repliesArgs: ConversationsRepliesArguments = {
        token,
        channel: event.channel,
        ts: event.originalMessageTs,
        latest: event.originalMessageParentTs,
        limit: 10,
        inclusive: true
      };
      const response = await app.client.conversations.replies(repliesArgs);
      messages = response.messages?.filter((message) => message.ts === event.originalMessageParentTs);
    } else {
      const historyArgs: ConversationsHistoryArguments = {
        token,
        channel: event.channel,
        latest: event.originalMessageTs,
        inclusive: true,
        limit: 10
      };
      const response = await app.client.conversations.history(historyArgs);
      messages = response.messages?.filter((message) => message.ts === event.originalMessageTs);
    }

    console.log("all of the messages found:", messages);
    if (!messages || messages.length < 1) {
      console.error('couldn\'t find the message to update');
      return;
    }
    originalMessage = messages[0];
    console.log("the message found", messages[0]);
  } catch (e: any | unknown) {
    console.error('error looking up message', e)
  }

  if (!originalMessage) {
    console.error('no original message found');
    return;
  }
  try {
    const updateArgs: ChatUpdateArguments = {
      token: token,
      ts: originalMessage.ts as string,
      channel: event.channel,
      text: `${originalMessage.text || ''}\n*Bonusly:*\n${bonuslyMessages.join('\n')}`,
    };
    await app.client.chat.update(updateArgs);
  } catch (e) {
    console.error('error updating the original message with bonusly bits', e)
  }
}

function buildBonuslyPayload(plusPlus: PPEvent, bonuslyAmount: number): TerseBonuslySentPayload {
  const bonuslyPayload: TerseBonuslySentPayload = {
    teamId: plusPlus.teamId,
    channel: plusPlus.channel,
    senderId: plusPlus.sender.slackId,
    recipientIds: plusPlus.recipients.map(recipient => recipient.slackId),
    amount: bonuslyAmount,
    originalMessageTs: plusPlus.originalMessageTs,
    originalMessageParentTs: plusPlus.originalMessageParentTs,
    reason: plusPlus.reason,
  };
  return bonuslyPayload;
}