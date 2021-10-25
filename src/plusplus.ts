import axios from 'axios';
import { EventEmitter } from 'events';
import { Blocks, Md, Message } from 'slack-block-builder';
import tokenBuddy from 'token-buddy';

import { ChatPostMessageArguments, WebClient } from '@slack/web-api';

import { app } from '../app';
import * as pjson from '../package.json';
import { Helpers } from './lib/helpers';
import { IUser, User } from './lib/models/user';
import { regExpCreator } from './lib/regexpCreator';
import { connectionFactory } from './lib/services/connectionsFactory';
import { DatabaseService } from './lib/services/database';
import { decrypt } from './lib/services/decrypt';
import { ScoreKeeper } from './lib/services/scorekeeper';
// this may need to move or be generic...er
import * as token from './lib/token.json';
import {
  DirectionEnum, PlusPlus, PlusPlusEventName, PlusPlusFailure, PlusPlusFailureEventName,
  PlusPlusSpam
} from './lib/types/PlusPlusEvents';

const procVars = Helpers.getProcessVariables(process.env);
const scoreKeeper = new ScoreKeeper({ ...procVars });
const databaseService = new DatabaseService({ ...procVars });
const emitter = new EventEmitter();

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
app.message(new RegExp('how much .*point.*', 'i'), tellHowMuchPointsAreWorth);
app.message(regExpCreator.createMultiUserVoteRegExp(), multipleUsersVote);

// listen for bot tag/ping
app.message(regExpCreator.createGiveTokenRegExp(), giveTokenBetweenUsers);
//directMention()
app.message(regExpCreator.getHelp(), respondWithHelpGuidance);
// directMention
app.message(RegExp(/(plusplus version|-v|--version)/, 'i'), async ({ message, context, say }) => {
  await say(`${Helpers.capitalizeFirstLetter('qrafty')} ${pjson.name}, version: ${pjson.version}`);
});

// admin
// directMention
app.message(regExpCreator.createEraseUserScoreRegExp(), eraseUserScore);

/**
 * Functions for responding to commands
 */
async function upOrDownVote({ payload, message, context, logger, say }) {
  logger.error(message, context, payload);
  const fullText = context.matches.input;
  const teamId = context.teamId;
  const { premessage, userId, operator, conjunction, reason } = context.matches.groups;

  if (Helpers.isKnownFalsePositive(premessage, conjunction, reason, operator)) {
    // circuit break a plus plus
    const failureEvent = new PlusPlusFailure({
      notificationMessage: `False positive detected in <#${message.channel}> from <@${message.user
        }>:\nPre-Message text: [${!!premessage}].\nMissing Conjunction: [${!!(!conjunction && reason)}]\n\n${fullText}`,
      channel: message.channel,
    });

    emitter.emit(PlusPlusFailureEventName, failureEvent);
    return;
  }
  const increment = operator.match(regExpCreator.positiveOperators) ? 1 : -1;
  const { channel } = message;

  const cleanReason = Helpers.cleanAndEncode(reason);
  const fromId = message.user;

  logger.debug(
    `${increment} score for [${userId}] from [${fromId}]${cleanReason ? ` because ${cleanReason}` : ''
    } in [${channel}]`,
  );
  let toUser;
  let fromUser;
  try {
    ({ toUser, fromUser } = await scoreKeeper.incrementScore(teamId, userId, fromId, channel, cleanReason, increment));
  } catch (e: any) {
    await say(e.message);
    return;
  }

  const theMessage = Helpers.getMessageForNewScore(toUser, cleanReason, 'qrafty');

  if (theMessage) {
    await say(theMessage);
    const plusPlusEvent = new PlusPlus({
      notificationMessage: `<@${fromUser.slackId}> ${operator.match(regExpCreator.positiveOperators) ? 'sent' : 'removed'
        } a ${Helpers.capitalizeFirstLetter('qrafty')} point ${operator.match(regExpCreator.positiveOperators) ? 'to' : 'from'
        } <@${toUser.slackId}> in <#${channel}>`,
      sender: fromUser,
      recipients: [toUser],
      direction: operator,
      amount: 1,
      channel,
      reason: cleanReason,
    });
    emitter.emit(PlusPlusEventName, plusPlusEvent);
  }
}

async function giveTokenBetweenUsers({ message, context, logger, say }) {
  const fullText = context.matches.input;
  const teamId = context.teamId;
  const { premessage, userId, number, conjunction, reason } = context.matches.groups;
  if (!conjunction && reason) {
    // circuit break a plus plus
    const failureEvent = new PlusPlusFailure({
      notificationMessage: `False positive detected in <#${message.channel}> from <@${message.user
        }>:\nPre-Message text: [${!!premessage}].\nMissing Conjunction: [${!!(!conjunction && reason)}]\n\n${fullText}`,
      channel: message.channel,
    });
    emitter.emit(PlusPlusFailureEventName, failureEvent);
    return;
  }
  const { channel } = message;
  const cleanReason = Helpers.cleanAndEncode(reason);
  const from = message.user;

  logger.debug(
    `${number} score for [${userId}] from [${from}]${cleanReason ? ` because ${cleanReason}` : ''} in [${channel}]`,
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
      notificationMessage: `<@${response.fromUser.slackId}> sent ${number} ${Helpers.capitalizeFirstLetter(
        'qrafty',
      )} point${parseInt(number, 10) > 1 ? 's' : ''} to <@${response.toUser.slackId}> in <#${channel}>`,
      recipients: [response.toUser],
      sender: response.fromUser,
      direction: DirectionEnum.PLUS,
      amount: number,
      channel,
      reason: cleanReason,
    });
    emitter.emit(PlusPlusEventName, plusPlusEvent);
  }
}

async function multipleUsersVote({ message, context, logger, say }) {
  const fullText = context.matches.input;
  const teamId = context.teamId;
  const { premessage, allUsers, operator, conjunction, reason } = context.matches.groups;
  if (!allUsers) {
    return;
  }
  if (Helpers.isKnownFalsePositive(premessage, conjunction, reason, operator)) {
    // circuit break a plus plus
    const failureEvent = new PlusPlusFailure({
      notificationMessage: `False positive detected in <#${message.channel}> from <@${message.user
        }>:\nPre-Message text: [${!!premessage}].\nMissing Conjunction: [${!!(!conjunction && reason)}]\n\n${fullText}`,
      channel: message.channel,
    });
    emitter.emit(PlusPlusFailureEventName, failureEvent);
    return;
  }

  const idArray = allUsers.trim().split(new RegExp(regExpCreator.multiUserSeparator)).filter(Boolean);
  logger.debug("We pulled all the user ids from the 'allUsers' regexp group", idArray.join(','));

  const { channel } = context;

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
  const from = message.user;
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
        `clean names map [${toUserId}]: ${response.toUser.score}, the reason ${response.toUser.reasons[cleanReason]}`,
      );
      messages.push(Helpers.getMessageForNewScore(response.toUser, cleanReason, 'qrafty'));
      to.push(response.toUser);
      notificationMessage.push(
        `<@${response.fromUser.slackId}> ${operator.match(regExpCreator.positiveOperators) ? 'sent' : 'removed'
        } a ${Helpers.capitalizeFirstLetter('qrafty')} point ${operator.match(regExpCreator.positiveOperators) ? 'to' : 'from'
        } <@${response.toUser.slackId}> in <#${channel}>`,
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
  });

  emitter.emit(PlusPlusEventName, plusPlusEvent);

  logger.debug(`These are the messages \n ${messages.join(' ')}`);
  await say(messages.join('\n'));
}

async function tellHowMuchPointsAreWorth({ payload, logger, message, context, say }) {
  logger.error(message, context, payload);
  try {
    const resp = await axios({
      url: 'https://api.coindesk.com/v1/bpi/currentprice/ARS.json',
    });

    const bitcoin = resp.data.bpi.USD.rate_float;
    const ars = resp.data.bpi.ARS.rate_float;
    const satoshi = bitcoin / 1e8;
    return say(
      `A bitcoin is worth ${bitcoin} USD right now (${ars} ARS), a satoshi is about ${satoshi}, and qrafty points are worth nothing!`,
    );
  } catch (e: any) {
    return await say(
      "Seems like we are having trouble getting some data... Don't worry, though, your qrafty points are still worth nothing!",
    );
  }
}

async function eraseUserScore({ message, context, say }) {
  let erased;
  const fullText = context.matches.input;
  const teamId = context.teamId;
  const { premessage, userId, conjunction, reason } = context.matches;
  const from = message.user;
  const { channel } = message;

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
      ? `Erased the following reason from <@${userId}>: ${decodedReason}`
      : `Erased points for <@${userId}>`;
    await say(message);
  }
}

async function respondWithHelpGuidance({ client, message, say }) {
  const helpMessage = ''
    .concat('`<name>++ [<reason>]` - Increment score for a name (for a reason)\n')
    .concat('`<name>-- [<reason>]` - Decrement score for a name (for a reason)\n')
    .concat('`{name1, name2, name3}++ [<reason>]` - Increment score for all names (for a reason)\n')
    .concat('`{name1, name2, name3}-- [<reason>]` - Decrement score for all names (for a reason) \n')
    .concat('`{name1, name2, name3}-- [<reason>]` - Decrement score for all names (for a reason) \n')
    .concat(`\`@${'qrafty'} score <name>\` - Display the score for a name and some of the reasons\n`)
    .concat(`\`@${'qrafty'} top <amount>\` - Display the top scoring <amount>\n`)
    .concat(`\`@${'qrafty'} erase <name> [<reason>]\` - Remove the score for a name (for a reason) \n`)
    .concat(`\`@${'qrafty'} level me up\` - Level up your account for some additional ${'qrafty'}iness \n`)
    .concat('`how much are <point_type> points worth` - Shows how much <point_type> points are worth\n');

  const theMessage = Message({ channel: message.channel, text: 'Help menu for Qrafty' })
    .blocks(
      Blocks.Header({ text: `Need help with ${'Qrafty'}?` }),
      Blocks.Section({ text: `_Commands_:` }),
      Blocks.Section({ text: helpMessage }),
      procVars.furtherHelpUrl
        ? Blocks.Section({
          text: `For further help please visit ${Md.link(procVars.furtherHelpUrl.toString(), 'Help Page')}`,
        })
        : undefined,
    )
    .asUser()
    .buildToObject();

  try {
    const result = await client.chat.postMessage(theMessage as ChatPostMessageArguments);
  } catch (e: any) {
    console.error('error', e.data.response_metadata.message);
  }
}
