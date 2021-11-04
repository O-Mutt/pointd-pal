import { Bits, Blocks, Elements, Md, Modal, Option } from 'slack-block-builder';
import { SlackModalDto } from 'slack-block-builder/dist/lib';

import { AllMiddlewareArgs, MessageShortcut, SlackShortcut, SlackShortcutMiddlewareArgs, SlackViewMiddlewareArgs, ViewSubmitAction } from '@slack/bolt';
import { View } from '@slack/types';

import { app } from '../app';
import { Helpers as H } from './lib/helpers';
import { IUser } from './lib/models/user';
import { ScoreKeeper } from './lib/services/scorekeeper';
import { actions } from './lib/types/Actions';
import { blocks } from './lib/types/BlockIds';
import { DirectionEnum } from './lib/types/Enums';
import { PlusPlus, PlusPlusEventName } from './lib/types/Events';
import { eventBus } from './lib/services/eventBus';
import { ChatGetPermalinkResponse } from '@slack/web-api';

const scoreKeeper = new ScoreKeeper();

app.shortcut(actions.shortcuts.message,
  async ({ shortcut, ack, body, client }: SlackShortcutMiddlewareArgs<MessageShortcut> & AllMiddlewareArgs) => {
    console.log('shortcut open');
    try {
      await ack();
      const channel = body.channel.id;
      const messageTs = body.message.ts;
      const { permalink }: ChatGetPermalinkResponse = await client.chat.getPermalink({ channel, message_ts: messageTs });


      const json: any = {
        channel,
        messageTs,
        permalink
      }

      const modalView = buildMessagePlusPlusModal(json, permalink);
      const result = await client.views.open({
        trigger_id: shortcut.trigger_id,
        view: modalView
      })
    } catch (e: any | unknown) {
      console.log('shortcut err', e);
    }
  });

function buildMessagePlusPlusModal(privateViewMetadataJson: JSON, permalink: string | undefined): SlackModalDto {

  return Modal({
    title: `${Md.emoji('rocket')} Send a PlusPlus`,
    submit: 'Send',
    callbackId: actions.shortcuts.message,
  }).blocks(
    Blocks.Header({ text: 'Basic Settings' }),
    Blocks.Input({ label: 'Who are you sending ++/-- to?', blockId: blocks.shortcuts.message.recipients }).element(
      Elements.UserMultiSelect({
        actionId: blocks.shortcuts.message.recipients,
        placeholder: 'Jill Example',
      }),
    ),
    Blocks.Input({ label: 'Are you giving them a point (++) or taking one away (--)?', blockId: blocks.shortcuts.message.operator }).element(
      Elements.StaticSelect({
        actionId: blocks.shortcuts.message.operator,
        placeholder: '++',
      }).options(
        Bits.Option({ text: DirectionEnum.PLUS, value: DirectionEnum.PLUS }),
        Bits.Option({ text: DirectionEnum.MINUS, value: DirectionEnum.MINUS }),
      ),
    ),
    Blocks.Input({ label: 'Why are you sending these points?', blockId: blocks.shortcuts.message.reason }).element(
      Elements.TextInput({
        actionId: blocks.shortcuts.message.reason,
        placeholder: 'Being the best co-worker in the world',
      }).initialValue(permalink ? `${Md.link(permalink, 'this message')}` : undefined),
    ).optional(),
  ).privateMetaData(JSON.stringify(privateViewMetadataJson))
    .buildToObject();
}

app.view(
  actions.shortcuts.message,
  async ({ ack, context, body, logger, view, respond, client }: SlackViewMiddlewareArgs<ViewSubmitAction> & AllMiddlewareArgs) => {
    await ack();
    const teamId = context.teamId as string;
    const from = body.user.id;
    const { channel, messageTs, permalink } = JSON.parse(view.private_metadata);

    let idArray: string[] = [];
    let operator: DirectionEnum = DirectionEnum.PLUS;
    let reason: string | null | undefined;
    const errors: { [blockId: string]: string; } = {};
    for (const option in view.state.values) {
      for (const key in view.state.values[option]) {
        const state = view.state.values[option][key];
        console.log("each key state:", state);
        switch (key) {
          case blocks.shortcuts.message.recipients: {
            idArray = state.selected_users as string[];
            break;
          }
          case blocks.shortcuts.message.operator: {
            operator = state.selected_option?.value as DirectionEnum;
            break;
          }
          case blocks.shortcuts.message.reason: {
            reason = state.value;
            break;
          }
        }
      }
    }


    idArray = idArray.filter((id) => id !== from);
    const cleanReason = H.cleanAndEncode(reason);
    const increment: number = operator === DirectionEnum.PLUS ? 1 : -1;

    logger.debug('We filtered out empty items and removed "self"', idArray.join(','));
    let messages: string[] = [];
    let notificationMessage: string[] = [];
    let sender: IUser | undefined = undefined;
    let to: IUser[] = [];
    for (const toUserId of idArray) {
      let response: { toUser: IUser; fromUser: IUser };
      try {
        response = await scoreKeeper.incrementScore(teamId, toUserId, from, channel, increment, cleanReason);
      } catch (e: any) {
        await respond(e.message);
        continue;
      }
      sender = response.fromUser;
      if (response.toUser) {
        logger.debug(
          `clean names map[${toUserId}]: ${response.toUser.score}, the reason ${cleanReason ? response.toUser.reasons.get(cleanReason) : 'n/a'} `,
        );
        messages.push(H.getMessageForNewScore(response.toUser, cleanReason));
        to.push(response.toUser);
        notificationMessage.push(
          `${Md.user(response.fromUser.slackId)} ${increment === 1 ? 'sent' : 'removed'
          } a Qrafty point ${increment === 1 ? 'to' : 'from'
          } ${Md.user(response.toUser.slackId)} in ${Md.channel(channel)} `,
        );
      }
    }
    messages = messages.filter((message) => !!message); // de-dupe
    if (messages) {
      logger.debug(`These are the messages \n ${messages.join(' ')} `);
      const postResp = await client.chat.postMessage(
        {
          text: messages.join('\n'),
          channel: channel,
          thread_ts: messageTs
        }
      );
      const plusPlusEvent = new PlusPlus({
        notificationMessage: notificationMessage.join('\n'),
        sender,
        recipients: to,
        direction: operator,
        amount: 1,
        channel,
        reason: cleanReason,
        teamId: teamId,
        originalMessage: messages.join('\n'),
        originalMessageTs: postResp.message?.ts as string,
      });

      eventBus.emit(PlusPlusEventName, plusPlusEvent);
    }
  }
);