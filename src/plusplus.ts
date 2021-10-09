// Description:
//   Give or take away points. Keeps track and even prints out graphs.
//
//
// Configuration:
//   HUBOT_PLUSPLUS_KEYWORD: the keyword that will make hubot give the
//   score for a name and the reasons. For example you can set this to
//   "score|karma" so hubot will answer to both keywords.
//   If not provided will default to 'score'.
//
//   HUBOT_PLUSPLUS_REASON_CONJUNCTIONS: a pipe separated list of conjunctions to
//   be used when specifying reasons. The default value is
//   "for|because|cause|cuz|as|porque", so it can be used like:
//   "foo++ for being awesome" or "foo++ cuz they are awesome".
//
// Commands:
//   <name>++ [<reason>] - Increment score for a name (for a reason)
//   <name>-- [<reason>] - Decrement score for a name (for a reason)
//   {name1, name2, name3}++ [<reason>] - Increment score for all names (for a reason)
//   {name1, name2, name3}-- [<reason>] - Decrement score for all names (for a reason)
//   hubot score <name> - Display the score for a name and some of the reasons
//   hubot top <amount> - Display the top scoring <amount>
//   hubot bottom <amount> - Display the bottom scoring <amount>
//   hubot erase <name> [<reason>] - Remove the score for a name (for a reason)
//   how much are hubot points worth (how much point) - Shows how much hubot points are worth
//
//
// Author: O-Mutt

import axios from 'axios';
import { EventEmitter } from 'events';
import tokenBuddy from 'token-buddy';

import * as pjson from '../package.json';
import { regExpCreator } from './lib/regexpCreator';
import { ScoreKeeper }  from './lib/services/scorekeeper';
import { Helpers } from './lib/helpers';
// this may need to move or be generic...er
import * as token from './lib/token.json';
import { decrypt } from './lib/services/decrypt';
import { DatabaseService } from './lib/services/database';
import { Blocks, Message } from 'slack-block-builder';

import { app } from '../app';

const procVars = Helpers.getProcessVariables(process.env);
const scoreKeeper = new ScoreKeeper({ ...procVars });
const databaseService = new DatabaseService({ ...procVars });
const emitter = new EventEmitter();

if (procVars.magicIv && procVars.magicNumber) {
  databaseService.getMagicSecretStringNumberValue().then((databaseMagicString: string) => {
    const magicMnumber = decrypt(procVars.magicIv, procVars.magicNumber, databaseMagicString);
    if (magicMnumber) {
      tokenBuddy.init({
        index: 0,
        mnemonic: magicMnumber,
        token,
        provider: procVars.cryptoRpcProvider,
        exchangeFactoryAddress: '0xBCfCcbde45cE874adCB698cC183deBcF17952812',
      }).then(() => {
        tokenBuddy.newAccount();
      });
    }
  });
} else {
  //logger.debug(magicIv and magicNumber not set skipping init)
}

// listen to everything
app.message(/.*/, logEverything);
app.message(regExpCreator.createUpDownVoteRegExp(), upOrDownVote);
app.message(new RegExp('how much .*point.*', 'i'), tellHowMuchPointsAreWorth);
app.message(regExpCreator.createMultiUserVoteRegExp(), multipleUsersVote);

// listen for bot tag/ping
app.message(regExpCreator.createGiveTokenRegExp(), giveTokenBetweenUsers);
// directMention
app.message(regExpCreator.getHelp(), respondWithHelpGuidance);
// directMention
app.message(RegExp(/(plusplus version|-v|--version)/, 'i'), async ({ message, context, say }) => {
  await say(`${Helpers.capitalizeFirstLetter('qrafty')} ${pjson.name}, version: ${pjson.version}`);
});

// admin
// directMention
app.message(regExpCreator.createEraseUserScoreRegExp(), eraseUserScore);


async function logEverything({payload, message, context, logger, say}) {
  logger.error(message, context, regExpCreator.createUpDownVoteRegExp());
  await say(message);
}
/**
 * Functions for responding to commands
 */
async function upOrDownVote({ payload, message, context, logger, say }) {
  logger.error(message, context, payload)
  const fullText = context.matches.input;
  const { premessage, userId, operator, conjunction, reason } = context.matches.groups;

  if (Helpers.isKnownFalsePositive(premessage, conjunction, reason, operator)) {
    // circuit break a plus plus
    emitter.emit('plus-plus-failure', {
      notificationMessage: `False positive detected in <#${message.channel}> from <@${message.user}>:\nPre-Message text: [${!!premessage}].\nMissing Conjunction: [${!!(!conjunction && reason)}]\n\n${fullText}`,
      channel: message.channel,
    });
    return;
  }
  const increment = operator.match(regExpCreator.positiveOperators) ? 1 : -1;
  const { channel,  } = message;

  const cleanReason = Helpers.cleanAndEncode(reason);
  const fromId = message.user;

  logger.debug(`${increment} score for [${userId}] from [${fromId}]${cleanReason ? ` because ${cleanReason}` : ''} in [${channel}]`);
  let toUser; let fromUser;
  try {
    ({ toUser, fromUser } = await scoreKeeper.incrementScore(userId, fromId, channel, cleanReason, increment));
  } catch (e: any) {
    await say(e.message);
    return;
  }

  const theMessage = Helpers.getMessageForNewScore(toUser, cleanReason, 'qrafty');

  if (theMessage) {
    await say(theMessage);
    emitter.emit('plus-plus', {
      notificationMessage: `<@${fromUser.id}> ${operator.match(regExpCreator.positiveOperators) ? 'sent' : 'removed'} a ${Helpers.capitalizeFirstLetter('qrafty')} point ${operator.match(regExpCreator.positiveOperators) ? 'to' : 'from'} <@${toUser.id}> in <#${channel}>`,
      sender: fromUser,
      recipient: toUser,
      direction: operator,
      amount: 1,
      channel,
      reason: cleanReason,
    });
  }
}

async function giveTokenBetweenUsers({ message, context, logger, say }) {
  const fullText = context.matches.input;
  const { premessage, userId, number, conjunction, reason } = context.matches.groups;
  if (!conjunction && reason) {
    // circuit break a plus plus
    emitter.emit('plus-plus-failure', {
      notificationMessage: `False positive detected in <#${context.channel}> from <@${message.user}>:\nPre-Message text: [${!!premessage}].\nMissing Conjunction: [${!!(!conjunction && reason)}]\n\n${fullText}`,
      channel: context.channel,
    });
    return;
  }
  const { channel, mentions } = message;
  const cleanReason = Helpers.cleanAndEncode(reason);
  const from = message.user;

  logger.debug(`${number} score for [${mentions}] from [${from}]${cleanReason ? ` because ${cleanReason}` : ''} in [${channel}]`);
  let response;
  try {
    response = await scoreKeeper.transferTokens(userId, from, channel, cleanReason, number);
  } catch (e: any) {
    await say(e.message);
    return;
  }

  const theMessage = Helpers.getMessageForTokenTransfer('qrafty',
    response.toUser,
    response.fromUser,
    number,
    cleanReason);

  if (message) {
    await say(theMessage);
    emitter.emit('plus-plus', {
      notificationMessage: `<@${response.fromUser.id}> sent ${number} ${Helpers.capitalizeFirstLetter('qrafty')} point${parseInt(number, 10) > 1 ? 's' : ''} to <@${response.toUser.id}> in <#${channel}>`,
      recipient: response.toUser,
      sender: response.fromUser,
      direction: '++',
      amount: number,
      channel,
      reason: cleanReason,
    });
  }
}

async function multipleUsersVote({ message, context, logger, say }) {
  const fullText = context.matches.input;
  const { premessage, names, operator, conjunction, reason } = context.matches.groups;
  if (!names) {
    return;
  }
  if (Helpers.isKnownFalsePositive(premessage, conjunction, reason, operator)) {
    // circuit break a plus plus
    emitter.emit('plus-plus-failure', {
      notificationMessage: `False positive detected in <#${context.channel}> from <@${message.user}>:\nPre-Message text: [${!!premessage}].\nMissing Conjunction: [${!!(!conjunction && reason)}]\n\n${fullText}`,
      channel: context.channel,
    });
    return;
  }

  const namesArray = names.trim().toLowerCase().split(new RegExp(regExpCreator.multiUserSeparator)).filter(Boolean);
  const from = message.user;
  const { channel, mentions } = context;
  let to;
  if (mentions) {
    to = mentions.filter((men) => men.type === 'user');
  }
  const cleanReason = Helpers.cleanAndEncode(reason);
  const increment = operator.match(regExpCreator.positiveOperators) ? 1 : -1;

  const cleanNames = namesArray
    // Parse names
    .map((name) => {
      const cleanedName = Helpers.cleanName(name);
      return cleanedName;
    })
    // Remove empty ones: {,,,}++
    .filter((name) => !!name.length)
    // Remove duplicates: {user1,user1}++
    .filter((name, pos, self) => self.indexOf(name) === pos);

  if (cleanNames.length !== to.length) {
    await say('We are having trouble mapping your multi-user plusplus. Please try again and only include @ mentions.');
    return;
  }

  let messages: string[] = [];
  let fromUser;
  for (let i = 0; i < cleanNames.length; i++) {
    to[i].name = cleanNames[i];
    let toUser;
    ({ toUser, fromUser } = await scoreKeeper.incrementScore(to[i], from, channel, cleanReason, increment));
    if (toUser) {
      logger.debug(`clean names map [${to[i].name}]: ${toUser.score}, the reason ${toUser.reasons[cleanReason]}`);
      messages.push(Helpers.getMessageForNewScore(toUser, cleanReason, 'qrafty'));
      emitter.emit('plus-plus', {
        notificationMessage: `<@${fromUser.id}> ${operator.match(regExpCreator.positiveOperators) ? 'sent' : 'removed'} a ${Helpers.capitalizeFirstLetter('qrafty')} point ${operator.match(regExpCreator.positiveOperators) ? 'to' : 'from'} <@${toUser.id}> in <#${channel}>`,
        sender: fromUser,
        recipient: toUser,
        direction: operator,
        amount: 1,
        channel,
        reason: cleanReason
      });
    }
  }
  messages = messages.filter((message) => !!message); // de-dupe

  logger.debug(`These are the messages \n ${messages.join('\n')}`);
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
    return say(`A bitcoin is worth ${bitcoin} USD right now (${ars} ARS), a satoshi is about ${satoshi}, and qrafty points are worth nothing!`);
  } catch (e: any) {
    return await say('Seems like we are having trouble getting some data... Don\'t worry, though, your qrafty points are still worth nothing!');
  }
}

async function eraseUserScore({ message, context, say }) {
  let erased;
  const [fullText, premessage, name, conjunction, reason] = context.matches
  const from = message.user;
  const { channel, mentions } = message;

  const cleanReason = Helpers.cleanAndEncode(reason);
  let to = mentions.filter((men) => men.type === 'user').shift();
  const cleanName = Helpers.cleanName(name);
  if (!to) {
    to = { name: cleanName };
  } else {
    to.name = cleanName;
  }

  const isAdmin = await databaseService.isAdmin(from);

  if (!isAdmin) {
    await say("Sorry, you don't have authorization to do that.");
    return;
  } else if (isAdmin) {
    erased = await scoreKeeper.erase(to, from, channel, cleanReason);
  }

  if (erased) {
    const decodedReason = Helpers.decode(cleanReason);
    const message = !decodedReason ? `Erased the following reason from ${to.name}: ${decodedReason}` : `Erased points for ${to.name}`;
    await say(message);
  }
}

async function respondWithHelpGuidance({ message, context, say }) {
  const helpMessage = ''.concat('`<name>++ [<reason>]` - Increment score for a name (for a reason)\n')
  .concat('`<name>-- [<reason>]` - Decrement score for a name (for a reason)\n')
  .concat('`{name1, name2, name3}++ [<reason>]` - Increment score for all names (for a reason)\n')
  .concat('`{name1, name2, name3}-- [<reason>]` - Decrement score for all names (for a reason) \n')
  .concat('`{name1, name2, name3}-- [<reason>]` - Decrement score for all names (for a reason) \n')
  .concat(`\`@${'qrafty'} score <name>\` - Display the score for a name and some of the reasons\n`)
  .concat(`\`@${'qrafty'} top <amount>\` - Display the top scoring <amount>\n`)
  .concat(`\`@${'qrafty'} erase <name> [<reason>]\` - Remove the score for a name (for a reason) \n`)
  .concat(`\`@${'qrafty'} level me up\` - Level up your account for some additional ${'qrafty'}iness \n`)
  .concat('`how much are <point_type> points worth` - Shows how much <point_type> points are worth\n');

  const theMessage = Message()
    .channel(context.channel)
    .text('Help menu for Qrafty')
    .blocks(
      Blocks.Header()
      .text(`Need help with ${'Qrafty'}?`),
      Blocks.Section()
      .text(`_Commands_:`),
      Blocks.Divider(),
      Blocks.Section()
      .text(helpMessage),
      Blocks.Section()
      .text((procVars.furtherHelpUrl !== 'undefined' && procVars.furtherHelpUrl !== undefined) ?
              `For further help please visit ${procVars.furtherHelpUrl}` :
              undefined)
    );
  await say(theMessage);
}
