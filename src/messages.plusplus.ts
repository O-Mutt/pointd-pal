import { Blocks, Md, Message } from 'slack-block-builder';
import tokenBuddy from 'token-buddy';


import { app } from '../app';
import { Helpers } from './lib/helpers';
import { IUser, User } from './lib/models/user';
import { regExpCreator } from './lib/regexpCreator';
import { DatabaseService } from './lib/services/database';
import { decrypt } from './lib/services/decrypt';
import { eventBus } from './lib/services/eventBus';
import { ScoreKeeper } from './lib/services/scorekeeper';
// this may need to move or be generic...er
import * as token from './lib/token.json';
import { DirectionEnum } from './lib/types/Enums';
import {
  PlusPlus, PlusPlusEventName, PlusPlusFailure, PlusPlusFailureEventName, PlusPlusSpam
} from './lib/types/Events';
import { AllMiddlewareArgs, directMention, SlackEventMiddlewareArgs } from '@slack/bolt';
import { connectionFactory } from './lib/services/connectionsFactory';

const procVars = Helpers.getProcessVariables(process.env);
const scoreKeeper = new ScoreKeeper({ ...procVars });
const databaseService = new DatabaseService({ ...procVars });

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
async function upOrDownVote(args) { // Ignoring types right now because the event is missing user -> : SlackEventMiddlewareArgs<'message'> & AllMiddlewareArgs) {
  const fullText = args.context.matches.input;
  const teamId = args.body.team_id;
  const { channel, user: from } = args.message;
  let { premessage, userId, operator, conjunction, reason } = args.context.matches.groups;
  const cleanReason = Helpers.cleanAndEncode(reason);


  if (userId.charAt(0).toLowerCase() === 's') {
    const { users } = await args.client.usergroups.users.list({ team_id: teamId, usergroup: userId });
    args.context.matches.groups.userId = users.join(',');
    return await multipleUsersVote(args);
  }

  if (Helpers.isKnownFalsePositive(premessage, conjunction, reason, operator)) {
    // circuit break a plus plus
    const failureEvent = new PlusPlusFailure({
      notificationMessage: `False positive detected in ${Md.channel(channel)} from ${Md.user(from)}: \nPre - Message text: [${!!premessage}].\nMissing Conjunction: [${!!(!conjunction && reason)}]\n\n${fullText} `,
      channel: channel,
      teamId: teamId,
    });
    console.log('emit an event', PlusPlusFailureEventName, failureEvent)
    eventBus.emit(PlusPlusFailureEventName, failureEvent);
    return;
  }
  const increment = operator.match(regExpCreator.positiveOperators) ? 1 : -1;

  args.logger.debug(
    `${increment} score for [${userId}] from[${from}]${cleanReason ? ` because ${cleanReason}` : ''
    } in [${channel}]`,
  );
  let toUser;
  let fromUser;
  try {
    ({ toUser, fromUser } = await scoreKeeper.incrementScore(teamId, userId, from, channel, increment, cleanReason));
  } catch (e: any) {
    const sayR = await args.say(e.message);
    return;
  }

  const theMessage = Helpers.getMessageForNewScore(toUser, cleanReason);

  if (theMessage) {
    const sayResponse = await args.say(theMessage);
    const plusPlusEvent = new PlusPlus({
      notificationMessage: `${Md.user(fromUser.slackId)} ${operator.match(regExpCreator.positiveOperators) ? 'sent' : 'removed'
        } a Qrafty point ${operator.match(regExpCreator.positiveOperators) ? 'to' : 'from'
        } ${Md.user(toUser.slackId)} in ${Md.channel(channel)}`,
      sender: fromUser,
      recipients: [toUser],
      direction: operator,
      amount: 1,
      channel,
      reason: cleanReason,
      teamId: teamId,
      originalMessage: theMessage,
      originalMessageTs: sayResponse.ts as string,
    });

    eventBus.emit(PlusPlusEventName, plusPlusEvent);
  }
}

async function giveTokenBetweenUsers({ message, context, logger, say }) {
  const fullText = context.matches.input;
  const teamId = context.teamId as string;
  let { premessage, userId, amount, conjunction, reason } = context.matches.groups;
  const cleanReason = Helpers.cleanAndEncode(reason);

  const { channel, user: from } = message;
  if (!conjunction && reason) {
    // circuit break a plus plus
    const failureEvent = new PlusPlusFailure({
      notificationMessage: `False positive detected in ${Md.channel(channel)} from ${Md.user(from)
        }: \nPre - Message text: [${!!premessage}].\nMissing Conjunction: [${!!(!conjunction && reason)}]\n\n${fullText} `,
      channel: channel,
      teamId: teamId,
    });
    eventBus.emit(PlusPlusFailureEventName, failureEvent);
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

  const theMessage = Helpers.getMessageForTokenTransfer(
    response.toUser,
    response.fromUser,
    amount,
    cleanReason,
  );

  if (message) {
    const sayResponse = await say(theMessage);
    const plusPlusEvent = new PlusPlus({
      notificationMessage: `${Md.user(response.fromUser.slackId)} sent ${amount} Qrafty point${parseInt(amount, 10) > 1 ? 's' : ''} to ${Md.user(response.toUser.slackId)} in ${Md.channel(channel)}`,
      recipients: [response.toUser],
      sender: response.fromUser,
      direction: DirectionEnum.PLUS,
      amount: amount,
      channel,
      reason: cleanReason,
      teamId: teamId,
      originalMessage: theMessage,
      originalMessageTs: sayResponse.ts as string,
    });
    eventBus.emit(PlusPlusEventName, plusPlusEvent);
  }
}

async function multipleUsersVote({ message, context, logger, say }) {
  const fullText = context.matches.input;
  const teamId = context.teamId as string;
  let { premessage, allUsers, operator, conjunction, reason } = context.matches.groups;
  const cleanReason = Helpers.cleanAndEncode(reason);

  const { channel, user: from } = message;
  if (!allUsers) {
    return;
  }
  if (Helpers.isKnownFalsePositive(premessage, conjunction, reason, operator)) {
    // circuit break a plus plus
    const failureEvent = new PlusPlusFailure({
      notificationMessage: `False positive detected in ${Md.channel(channel)} from ${Md.user(from)
        }: \nPre - Message text: [${!!premessage}].\nMissing Conjunction: [${!!(!conjunction && reason)}]\n\n${fullText} `,
      channel: channel,
      teamId: teamId,
    });
    eventBus.emit(PlusPlusFailureEventName, failureEvent);
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
  let to: IUser[] = [];
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
        `clean names map[${toUserId}]: ${response.toUser.score}, the reason ${cleanReason ? response.toUser.reasons.get(cleanReason) : 'n/a'} `,
      );
      messages.push(Helpers.getMessageForNewScore(response.toUser, cleanReason));
      to.push(response.toUser);
      notificationMessage.push(
        `${Md.user(response.fromUser.slackId)} ${operator.match(regExpCreator.positiveOperators) ? 'sent' : 'removed'
        } a Qrafty point ${operator.match(regExpCreator.positiveOperators) ? 'to' : 'from'
        } ${Md.user(response.toUser.slackId)} in ${Md.channel(channel)} `,
      );
    }
  }
  messages = messages.filter((message) => !!message); // de-dupe
  logger.debug(`These are the messages \n ${messages.join(' ')} `);
  const sayResponse = await say(messages.join('\n'));
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
    originalMessageTs: sayResponse.ts as string,
  });

  eventBus.emit(PlusPlusEventName, plusPlusEvent);
}

async function eraseUserScore({ message, context, say }) {
  let erased;
  const fullText = context.matches.input;
  const teamId = context.teamId as string;
  const { premessage, userId, conjunction, reason } = context.matches.groups;
  const { channel, user: from } = message;
  const cleanReason = Helpers.cleanAndEncode(reason);

  const fromUser = await User(connectionFactory(teamId)).findOneBySlackIdOrCreate(teamId, from);
  const toBeErased = await User(connectionFactory(teamId)).findOneBySlackIdOrCreate(teamId, userId);

  if (fromUser.isAdmin !== true) {
    await say("Sorry, you don't have authorization to do that.");
    return;
  }

  erased = await scoreKeeper.erase(teamId, toBeErased, fromUser, channel, cleanReason);

  if (erased) {
    const message = !reason
      ? `Erased the following reason from ${Md.user(userId)}: ${reason} `
      : `Erased points for ${Md.user(userId)} `;
    await say(message);
  }
}


