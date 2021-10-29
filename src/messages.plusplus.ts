import { Blocks, Md, Message } from 'slack-block-builder';
import tokenBuddy from 'token-buddy';

import { ChatPostMessageArguments } from '@slack/web-api';

import { app } from '../app';
import { Helpers } from './lib/helpers';
import { IUser } from './lib/models/user';
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
import { directMention } from '@slack/bolt';

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
  const { premessage, userId, operator, conjunction, reason } = args.context.matches.groups;

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


  const cleanReason = Helpers.cleanAndEncode(reason);

  args.logger.debug(
    `${increment} score for [${userId}] from[${from}]${cleanReason ? ` because ${cleanReason}` : ''
    } in [${channel}]`,
  );
  let toUser;
  let fromUser;
  try {
    ({ toUser, fromUser } = await scoreKeeper.incrementScore(teamId, userId, from, channel, cleanReason, increment));
  } catch (e: any) {
    await args.say(e.message);
    return;
  }

  const theMessage = Helpers.getMessageForNewScore(toUser, cleanReason, 'qrafty');

  if (theMessage) {
    await args.say(theMessage);
    const plusPlusEvent = new PlusPlus({
      notificationMessage: `${Md.user(fromUser.slackId)} ${operator.match(regExpCreator.positiveOperators) ? 'sent' : 'removed'
        } a ${Helpers.capitalizeFirstLetter('qrafty')} point ${operator.match(regExpCreator.positiveOperators) ? 'to' : 'from'
        } ${Md.user(toUser.slackId)} in ${Md.channel(channel)}`,
      sender: fromUser,
      recipients: [toUser],
      direction: operator,
      amount: 1,
      channel,
      reason: cleanReason,
      teamId: teamId,
    });
    eventBus.emit(PlusPlusEventName, plusPlusEvent);
  }
}

async function giveTokenBetweenUsers({ message, context, logger, say }) {
  const fullText = context.matches.input;
  const teamId = context.teamId as string;
  const { premessage, userId, number, conjunction, reason } = context.matches.groups;
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
  const cleanReason = Helpers.cleanAndEncode(reason);

  logger.debug(
    `${number} score for [${userId}] from[${from}]${cleanReason ? ` because ${cleanReason}` : ''} in [${channel}]`,
  );
  let response;
  try {
    response = await scoreKeeper.transferTokens(teamId, userId, from, channel, cleanReason, number);
  } catch (e: any) {
    await say(e.message);
    return;
  }

  const theMessage = Helpers.getMessageForTokenTransfer(
    'qrafty',
    response.toUser,
    response.fromUser,
    number,
    cleanReason,
  );

  if (message) {
    await say(theMessage);
    const plusPlusEvent = new PlusPlus({
      notificationMessage: `${Md.user(response.fromUser.slackId)} sent ${number} ${Helpers.capitalizeFirstLetter(
        'qrafty',
      )
        } point${parseInt(number, 10) > 1 ? 's' : ''} to ${Md.user(response.toUser.slackId)} in ${Md.channel(channel)}`,
      recipients: [response.toUser],
      sender: response.fromUser,
      direction: DirectionEnum.PLUS,
      amount: number,
      channel,
      reason: cleanReason,
      teamId: teamId,
    });
    eventBus.emit(PlusPlusEventName, plusPlusEvent);
  }
}

async function multipleUsersVote({ message, context, logger, say }) {
  const fullText = context.matches.input;
  const teamId = context.teamId as string;
  const { premessage, allUsers, operator, conjunction, reason } = context.matches.groups;
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

  const cleanReason = Helpers.cleanAndEncode(reason);
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
      response = await scoreKeeper.incrementScore(teamId, toUserId, from, channel, cleanReason, increment);
    } catch (e: any) {
      await say(e.message);
      continue;
    }
    sender = response.fromUser;
    if (response.toUser) {
      logger.debug(
        `clean names map[${toUserId}]: ${response.toUser.score}, the reason ${response.toUser.reasons.get(cleanReason)} `,
      );
      messages.push(Helpers.getMessageForNewScore(response.toUser, cleanReason, 'qrafty'));
      to.push(response.toUser);
      notificationMessage.push(
        `${Md.user(response.fromUser.slackId)} ${operator.match(regExpCreator.positiveOperators) ? 'sent' : 'removed'
        } a ${Helpers.capitalizeFirstLetter('qrafty')} point ${operator.match(regExpCreator.positiveOperators) ? 'to' : 'from'
        } ${Md.user(response.toUser.slackId)} in ${Md.channel(channel)} `,
      );
    }
  }
  messages = messages.filter((message) => !!message); // de-dupe
  const plusPlusEvent = new PlusPlus({
    notificationMessage: notificationMessage.join('\n'),
    sender,
    recipients: to,
    direction: operator,
    amount: 1,
    channel,
    reason: cleanReason,
    teamId: teamId,
  });

  eventBus.emit(PlusPlusEventName, plusPlusEvent);

  logger.debug(`These are the messages \n ${messages.join(' ')} `);
  await say(messages.join('\n'));
}

async function eraseUserScore({ message, context, say }) {
  let erased;
  const fullText = context.matches.input;
  const teamId = context.teamId as string;
  const { premessage, userId, conjunction, reason } = context.matches;
  const { channel, user: from } = message;

  const cleanReason = Helpers.cleanAndEncode(reason);

  const fromUser = await databaseService.getUser(teamId, from);
  const isAdmin = fromUser.isAdmin;

  if (!isAdmin) {
    await say("Sorry, you don't have authorization to do that.");
    return;
  } else if (isAdmin) {
    erased = await scoreKeeper.erase(teamId, userId, from, channel, cleanReason);
  }

  if (erased) {
    const decodedReason = Helpers.decode(cleanReason);
    const message = !decodedReason
      ? `Erased the following reason from ${Md.user(userId)}: ${decodedReason} `
      : `Erased points for ${Md.user(userId)} `;
    await say(message);
  }
}


