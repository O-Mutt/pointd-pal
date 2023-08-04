import { Blocks, Md, Message } from 'slack-block-builder';
import tokenBuddy from 'token-buddy';

import { app } from '../app';
import { Helpers as H } from './lib/helpers';
import { MessageBuilder as Builder } from './lib/messageBuilder';
import { IUser, User } from './entities/user';
import { regExpCreator } from './lib/regexpCreator';
import { DatabaseService } from './lib/services/database';
import { decrypt } from './lib/services/decrypt';
import { eventBus } from './lib/services/eventBus';
import { ScoreKeeper } from './lib/services/scorekeeper';
// this may need to move or be generic...er
import * as token from './lib/token.json';
import { DirectionEnum } from './lib/types/Enums';
import { PPEvent, PPEventName, PPFailureEvent, PPFailureEventName } from './lib/types/Events';
import { directMention } from '@slack/bolt';
import { connectionFactory } from './lib/services/connectionsFactory';
import { ChatPostMessageResponse } from '@slack/web-api';

require('dotenv').config();
const procVars = H.getProcessVariables(process.env);
const scoreKeeper = new ScoreKeeper();
const databaseService = new DatabaseService();

if (procVars.magicIv && procVars.magicNumber) {
  databaseService.getMagicSecretStringNumberValue().then((databaseMagicString: string) => {
    const magicMnumber = decrypt(procVars.magicIv as string, procVars.magicNumber as string, databaseMagicString);
    if (magicMnumber) {
      tokenBuddy
        .init({
          index: 0,
          mnemonic: magicMnumber,
          token,
          provider: procVars.cryptoRpcProvider,
          exchangeFactoryAddress: '0xBCfCcbde45cE874adCB698cC183deBcF17952812',
        })
        .then(() => {
          tokenBuddy.newAccount();
        });
    }
  });
} else {
  //logger.debug(magicIv and magicNumber not set skipping init)
}

// listen to everything
app.message(regExpCreator.createUpDownVoteRegExp(), upOrDownVote);
app.message(regExpCreator.createMultiUserVoteRegExp(), multipleUsersVote);

// listen for bot tag/ping
app.message(regExpCreator.createGiveTokenRegExp(), directMention(), giveTokenBetweenUsers);

// admin
app.message(regExpCreator.createEraseUserScoreRegExp(), directMention(), eraseUserScore);

/**
 * Functions for responding to commands
 */
async function upOrDownVote(args) {
  // Ignoring types right now because the event is missing user -> : SlackEventMiddlewareArgs<'message'> & AllMiddlewareArgs) {
  const fullText = args.context.matches.input;
  const teamId = args.body.team_id;
  const { channel, user: from } = args.message;
  let { premessage, userId, operator, conjunction, reason } = args.context.matches.groups;
  const cleanReason = H.cleanAndEncode(reason);

  if (userId.charAt(0).toLowerCase() === 's') {
    const { users } = await args.client.usergroups.users.list({ team_id: teamId, usergroup: userId });
    args.context.matches.groups.userId = users.join(',');
    return await multipleUsersVote(args);
  }

  if (H.isKnownFalsePositive(premessage, conjunction, reason, operator)) {
    // circuit break a plus plus
    const failureEvent: PPFailureEvent = {
      sender: from as string,
      recipients: userId as string,
      notificationMessage: `False positive detected in ${Md.channel(channel)} from ${Md.user(
        from,
      )}: \nPre - Message text: [${!!premessage}].\nMissing Conjunction: [${!!(
        !conjunction && reason
      )}]\n\n${fullText} `,
      channel: channel,
      teamId: teamId,
    };
    console.log('emit an event', PPFailureEventName, failureEvent);
    eventBus.emit(PPFailureEventName, failureEvent);
    return;
  }
  const increment = operator.match(regExpCreator.positiveOperators) ? 1 : -1;

  args.logger.debug(
    `${increment} score for [${userId}] from[${from}]${cleanReason ? ` because ${cleanReason}` : ''} in [${channel}]`,
  );
  let toUser;
  let fromUser;
  try {
    ({ toUser, fromUser } = await scoreKeeper.incrementScore(teamId, userId, from, channel, increment, cleanReason));
  } catch (e: any) {
    const sayR = await args.say(e.message);
    return;
  }

  const theMessage = Builder.getMessageForNewScore(toUser, cleanReason);

  if (theMessage) {
    const sayArgs = H.getSayMessageArgs(args.message, theMessage);
    const sayResponse: ChatPostMessageResponse = await args.say(sayArgs);

    const plusPlusEvent: PPEvent = {
      notificationMessage: `${Md.user(fromUser.slackId)} ${
        operator.match(regExpCreator.positiveOperators) ? 'sent' : 'removed'
      } a PointdPal point ${operator.match(regExpCreator.positiveOperators) ? 'to' : 'from'} ${Md.user(
        toUser.slackId,
      )} in ${Md.channel(channel)}`,
      sender: fromUser,
      recipients: [toUser],
      direction: operator,
      amount: 1,
      channel,
      reason: cleanReason,
      teamId: teamId,
      originalMessageTs: H.getMessageTs(sayResponse.message) as string,
      originalMessageParentTs: H.getMessageParentTs(sayResponse.message),
    };

    eventBus.emit(PPEventName, plusPlusEvent);
  }
}

async function giveTokenBetweenUsers({ message, context, logger, say }) {
  const fullText = context.matches.input;
  const teamId = context.teamId as string;
  let { premessage, userId, amount, conjunction, reason } = context.matches.groups;
  const cleanReason = H.cleanAndEncode(reason);

  const { channel, user: from } = message;
  if (!conjunction && reason) {
    // circuit break a plus plus
    const failureEvent: PPFailureEvent = {
      sender: from as string,
      recipients: userId as string,
      notificationMessage: `False positive detected in ${Md.channel(channel)} from ${Md.user(
        from,
      )}: \nPre - Message text: [${!!premessage}].\nMissing Conjunction: [${!!(
        !conjunction && reason
      )}]\n\n${fullText} `,
      channel: channel,
      teamId: teamId,
    };
    eventBus.emit(PPFailureEventName, failureEvent);
    return;
  }

  console.debug(
    `${amount} score for [${userId}] from[${from}]${cleanReason ? ` because ${cleanReason}` : ''} in [${channel}]`,
  );
  let response;
  try {
    response = await scoreKeeper.transferTokens(teamId, userId, from, channel, amount, cleanReason);
  } catch (e: any) {
    await say(e.message);
    return;
  }

  const theMessage = H.getMessageForTokenTransfer(response.toUser, response.fromUser, amount, cleanReason);

  if (message) {
    const sayArgs = H.getSayMessageArgs(message, theMessage);
    const sayResponse = await say(sayArgs);
    const plusPlusEvent: PPEvent = {
      notificationMessage: `${Md.user(response.fromUser.slackId)} sent ${amount} PointdPal point${
        parseInt(amount, 10) > 1 ? 's' : ''
      } to ${Md.user(response.toUser.slackId)} in ${Md.channel(channel)}`,
      recipients: [response.toUser],
      sender: response.fromUser,
      direction: DirectionEnum.PLUS,
      amount: amount,
      channel,
      reason: cleanReason,
      teamId: teamId,
      originalMessageTs: H.getMessageTs(sayResponse.message),
      originalMessageParentTs: H.getMessageParentTs(sayResponse.message),
    };

    eventBus.emit(PPEventName, plusPlusEvent);
  }
}

async function multipleUsersVote({ message, context, logger, say }) {
  const fullText = context.matches.input;
  const teamId = context.teamId as string;
  let { premessage, allUsers, operator, conjunction, reason } = context.matches.groups;
  const cleanReason = H.cleanAndEncode(reason);

  const { channel, user: from } = message;
  if (!allUsers) {
    return;
  }
  if (H.isKnownFalsePositive(premessage, conjunction, reason, operator)) {
    // circuit break a plus plus
    const failureEvent: PPFailureEvent = {
      sender: from as string,
      recipients: allUsers as string[],
      notificationMessage: `False positive detected in ${Md.channel(channel)} from ${Md.user(
        from,
      )}: \nPre - Message text: [${!!premessage}].\nMissing Conjunction: [${!!(
        !conjunction && reason
      )}]\n\n${fullText} `,
      channel: channel,
      teamId: teamId,
    };
    eventBus.emit(PPFailureEventName, failureEvent);
    return;
  }

  const idArray = allUsers.trim().split(new RegExp(regExpCreator.multiUserSeparator)).filter(Boolean);
  logger.debug("We pulled all the user ids from the 'allUsers' regexp group", idArray.join(','));

  const increment = operator.match(regExpCreator.positiveOperators) ? 1 : -1;

  const cleanedIdArray = idArray
    // Remove empty ones: {,,,}++
    .filter((id) => !!id.length)
    // remove <@.....>
    .map((id) => id.replace(new RegExp(regExpCreator.userObject), '$1'))
    // Remove duplicates: {user1,user1}++
    .filter((id, pos, self) => self.indexOf(id) === pos);

  logger.debug('We filtered out empty items and removed "self"', cleanedIdArray.join(','));
  let messages: string[] = [];
  let notificationMessage: string[] = [];
  let sender: IUser | undefined = undefined;
  let recipients: IUser[] = [];
  for (const toUserId of cleanedIdArray) {
    let response: { toUser: IUser; fromUser: IUser };
    try {
      response = await scoreKeeper.incrementScore(teamId, toUserId, from, channel, increment, cleanReason);
    } catch (e: any) {
      await say(e.message);
      continue;
    }
    sender = response.fromUser;
    if (response.toUser) {
      logger.debug(
        `clean names map[${toUserId}]: ${response.toUser.score}, the reason ${
          cleanReason ? response.toUser.reasons.get(cleanReason) : 'n/a'
        } `,
      );
      messages.push(Builder.getMessageForNewScore(response.toUser, cleanReason));
      recipients.push(response.toUser);
      notificationMessage.push(
        `${Md.user(response.fromUser.slackId)} ${
          operator.match(regExpCreator.positiveOperators) ? 'sent' : 'removed'
        } a PointdPal point ${operator.match(regExpCreator.positiveOperators) ? 'to' : 'from'} ${Md.user(
          response.toUser.slackId,
        )} in ${Md.channel(channel)} `,
      );
    }
  }

  messages = messages.filter((message) => !!message); // de-dupe
  if (messages) {
    logger.debug(`These are the messages \n ${messages.join(' ')} `);
    const sayArgs = H.getSayMessageArgs(message, messages.join('\n'));
    const sayResponse = await say(sayArgs);
    const plusPlusEvent: PPEvent = {
      notificationMessage: notificationMessage.join('\n'),
      sender: sender as IUser,
      recipients,
      direction: operator,
      amount: 1,
      channel,
      reason: cleanReason,
      teamId: teamId,
      originalMessageTs: H.getMessageTs(sayResponse.message),
      originalMessageParentTs: H.getMessageParentTs(sayResponse.message),
    };

    eventBus.emit(PPEventName, plusPlusEvent);
  }
}

async function eraseUserScore({ message, context, say }) {
  let erased;
  const fullText = context.matches.input;
  const teamId = context.teamId as string;
  const { premessage, userId, conjunction, reason } = context.matches.groups;
  const { channel, user: from } = message;
  const cleanReason = H.cleanAndEncode(reason);

  const fromUser = await User(connectionFactory(teamId)).findOneBySlackIdOrCreate(teamId, from);
  const toBeErased = await User(connectionFactory(teamId)).findOneBySlackIdOrCreate(teamId, userId);

  if (fromUser.isAdmin !== true) {
    await say("Sorry, you don't have authorization to do that.");
    return;
  }

  erased = await scoreKeeper.erase(teamId, toBeErased, fromUser, channel, cleanReason);

  if (erased) {
    const messageText = reason
      ? `Erased the following reason from ${Md.user(userId)}: ${reason} `
      : `Erased points for ${Md.user(userId)} `;

    const sayArgs = H.getSayMessageArgs(message, messageText);
    const sayResponse = await say(sayArgs);
  }
}
