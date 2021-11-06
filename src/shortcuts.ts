import { Bits, Blocks, Elements, Md, Modal, Option, OptionBuilder } from 'slack-block-builder';
import { SlackModalDto } from 'slack-block-builder/dist/lib';

import {
  AllMiddlewareArgs, MessageShortcut, SlackCommandMiddlewareArgs, SlackShortcut, SlackShortcutMiddlewareArgs,
  SlackViewMiddlewareArgs, ViewSubmitAction
} from '@slack/bolt';
import { View } from '@slack/types';
import { ChatGetPermalinkResponse, ChatPostEphemeralArguments, ChatPostMessageArguments } from '@slack/web-api';

import { app } from '../app';
import { Helpers as H } from './lib/helpers';
import { IUser } from './lib/models/user';
import { eventBus } from './lib/services/eventBus';
import { ScoreKeeper } from './lib/services/scorekeeper';
import { actions } from './lib/types/Actions';
import { blocks } from './lib/types/BlockIds';
import { DirectionEnum } from './lib/types/Enums';
import { PPEvent, PPEventName } from './lib/types/Events';
import { regExpCreator } from './lib/regexpCreator';

const scoreKeeper = new ScoreKeeper();

app.command('/plusplus', handleSlashCommand);
app.shortcut(actions.shortcuts.message, handleShortcut);

async function handleSlashCommand({ ack, body, command, client }: SlackCommandMiddlewareArgs & AllMiddlewareArgs) {
  try {
    await ack();
    const singleUser = regExpCreator.createUpDownVoteRegExp();
    const multiUser = regExpCreator.createMultiUserVoteRegExp();
    let userIds, operator, reason;
    if (body.text) {
      const isSingleUser = singleUser.test(body.text);
      const isMultiUser = multiUser.test(body.text);
      if (isSingleUser) {
        const matches = body.text.match(singleUser)?.groups;
        console.log(matches);
        if (matches) {
          userIds = [matches['userId']];
          operator = matches['operator'];
          reason = matches['reason'];
        }
      } else if (isMultiUser) {
        const matches = body.text.match(multiUser)?.groups;
        if (matches) {
          userIds = matches['allUsers'].trim().split(new RegExp(regExpCreator.multiUserSeparator)).filter(Boolean);
          userIds = userIds
            // Remove empty ones: {,,,}++
            .filter((id) => !!id.length)
            // remove <@.....>
            .map((id) => id.replace(new RegExp(regExpCreator.userObject), '$1'))
            // Remove duplicates: {user1,user1}++
            .filter((id, pos, self) => self.indexOf(id) === pos);
          operator = matches['operator'];
          reason = matches['reason'];
        }
      }
    }
    console.log(command, body);
    const channel = body.channel_id;

    const json: any = {
      channel
    }

    const localOptions = {
      userIds,
      operator,
      reason
    }

    const modalView = buildMessagePlusPlusModal(json, localOptions);
    const result = await client.views.open({
      trigger_id: command.trigger_id,
      view: modalView
    })
  } catch (e: any | unknown) {
    console.log('slash err', e);
  }

}

async function handleShortcut({ shortcut, ack, body, client }: SlackShortcutMiddlewareArgs<MessageShortcut> & AllMiddlewareArgs) {
  try {
    await ack();
    console.log(body)
    const channel = body.channel.id;
    const messageTs = body.message.ts;
    const userId = body.message.user;
    const { permalink }: ChatGetPermalinkResponse = await client.chat.getPermalink({ channel, message_ts: messageTs });


    const json: any = {
      channel,
      messageTs,
      permalink,
    }
    const localOptions = {
      userIds: [userId],
      permalink
    }

    const modalView = buildMessagePlusPlusModal(json, localOptions);
    const result = await client.views.open({
      trigger_id: shortcut.trigger_id,
      view: modalView
    })
  } catch (e: any | unknown) {
    console.log('shortcut err', e);
  }
}

function buildMessagePlusPlusModal(privateViewMetadataJson: any, localOptions: any): SlackModalDto {

  const permlink = localOptions.permalink ? `${Md.link(localOptions.permalink, 'this message')}` : undefined;
  const initialReason = localOptions.reason || permlink
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
      }).initialUsers(localOptions.userIds),
    ),
    Blocks.Input({ label: 'Are you giving them a point (++) or taking one away (--)?', blockId: blocks.shortcuts.message.operator }).element(
      Elements.StaticSelect({
        actionId: blocks.shortcuts.message.operator,
        placeholder: '++',
      }).options(
        Bits.Option({ text: DirectionEnum.PLUS, value: DirectionEnum.PLUS }),
        Bits.Option({ text: DirectionEnum.MINUS, value: DirectionEnum.MINUS }),
      ).initialOption(localOptions.operator ?
        Bits.Option({ text: localOptions.operator, value: localOptions.operator })
        : undefined),
    ),
    Blocks.Input({ label: 'Why are you sending these points?', blockId: blocks.shortcuts.message.reason }).element(
      Elements.TextInput({
        actionId: blocks.shortcuts.message.reason,
        placeholder: 'Being the best co-worker in the world',
      }).initialValue(initialReason),
    ).optional(),
  ).privateMetaData(JSON.stringify(privateViewMetadataJson))
    .buildToObject();
}

app.view(
  actions.shortcuts.message,
  async ({ ack, context, body, logger, view, client }: SlackViewMiddlewareArgs<ViewSubmitAction> & AllMiddlewareArgs) => {
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
    let recipients: IUser[] = [];
    for (const toUserId of idArray) {
      let response: { toUser: IUser; fromUser: IUser };
      try {
        response = await scoreKeeper.incrementScore(teamId, toUserId, from, channel, increment, cleanReason);
      } catch (e: any) {
        const ephemeral: ChatPostEphemeralArguments = {
          text: e.message,
          channel,
          user: from
        };
        await client.chat.postEphemeral(ephemeral);

        continue;
      }
      sender = response.fromUser;
      if (response.toUser) {
        logger.debug(
          `clean names map[${toUserId}]: ${response.toUser.score}, the reason ${cleanReason ? response.toUser.reasons.get(cleanReason) : 'n/a'} `,
        );
        messages.push(H.getMessageForNewScore(response.toUser, cleanReason));
        recipients.push(response.toUser);
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
      const postArgs: ChatPostMessageArguments = {
        text: messages.join('\n'),
        channel: channel,
      };
      if (messageTs) {
        postArgs.thread_ts = messageTs
      }
      const postResp = await client.chat.postMessage(postArgs);
      console.log("the message post response", postResp);
      const plusPlusEvent: PPEvent = {
        notificationMessage: notificationMessage.join('\n'),
        sender: sender as IUser,
        recipients: recipients,
        direction: operator,
        amount: 1,
        channel,
        reason: cleanReason,
        teamId: teamId,
        originalMessageTs: postResp.message?.thread_ts as string,
        originalMessageParentTs: postResp.ts as string,
      };

      eventBus.emit(PPEventName, plusPlusEvent);
    }
  }
);