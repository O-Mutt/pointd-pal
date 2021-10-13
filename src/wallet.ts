// Description:
//  Hubot crypto wallet. This is used to manage the users wallet within the hubot-plusplus-expanded module
//
// Commands:
//  @hubot hot wallet - displays info for hubot's 'hot wallet'
//  @hubot level up my account - moves the user's account up 1 level (e.g. 1->2) to allow them to start receiving crypto
//
// Author:
//  O'Mutt (Matt@OKeefe.dev)
import _ from 'lodash';
import tokenBuddy from 'token-buddy';
import { directMention, Logger } from '@slack/bolt';
import { Message, Blocks, Elements } from 'slack-block-builder';
import { app } from '../app';

import { Helpers } from './lib/helpers';
import { regExpCreator } from './lib/regexpCreator';
import { DatabaseService } from './lib/services/database';
import { IBotToken } from './lib/models/botToken';

  const procVars = Helpers.getProcessVariables(process.env);
  const databaseService = new DatabaseService({ ...procVars });

// directMention()
app.message(regExpCreator.getBotWallet(), botWalletCount);

// DM only
// directMention()
app.message(regExpCreator.createLevelUpAccount(), levelUpAccount);

async function levelUpAccount({ message, context, say }) {
  if (!Helpers.isPrivateMessage(message.channel)) {
    return await say(`You should only execute a level up from within the context of a DM with ${'qrafty'}`);
  }

  const user = await databaseService.getUser(message.user);
  if (user.accountLevel === 2) {
    const theBlocks = Message({ channel: context.channel, text: "Let's level you up!" })
      .blocks(
        Blocks.Section({ text: `You are already Level 2, <@${user.slackId}>. It looks as if you are ready for Level 3 where you can deposit/withdraw ${Helpers.capitalizeFirstLetter('qrafty')} Tokens!`}),
        Blocks.Actions()
        .elements(
          Elements.Button({ text: "Confirm", actionId: 'confirm_levelup' }).primary(),
          Elements.Button({ text: "Cancel", actionId: 'cancel_levelup' }).danger()
        )
      ).asUser().buildToJSON();

    await say(theBlocks);

  /*
   dialog.addChoice(/yes/i, (msg2) => {
      // do the level 3 step up, get their info for deposit withdrawal
      msg2.reply(`Hey ${user.name}, looks like you are ready for Level 3 but I'm not :sob:. Level 3 is still WIP and will be available very soon!`);
    });
    dialog.addChoice(/no/i, (msg2) => {
      msg2.reply('Woops. My mistake. Carry on++');
    });
    return false;
    */
  }

  
  const leveledUpUser = await databaseService.updateAccountLevelToTwo(user);
  //Logger.debug('DB results', leveledUpUser);

  //await say(`${user.name}, we are going to level up your account to Level 2! This means you will start getting ${helpers.capitalizeFirstLetter('qrafty')} Tokens as well as points!`);
}

async function botWalletCount({ context, say }) {
  const botWallet: IBotToken = await databaseService.getBotWallet();
  //Logger.debug(`Get the bot wallet by user ${message.user.name}, ${botWallet}`);
  let gas;
  try {
    gas = await tokenBuddy.getBalance(botWallet.publicWalletAddress);
  } catch (e) {
    await say(`An error occurred getting ${'qrafty'}'s gas amount`);
  }
  //Logger.debug(`Get the bot wallet by user ${message.user.name}, ${_.pick(JSON.stringify(botWallet), ['publicWalletAddress', 'name', 'token'])}`);

  const theBlocks = Message({ channel: context.channel, text: `${Helpers.capitalizeFirstLetter('qrafty')} Wallet:` })
      .blocks(
        Blocks.Section({ text: `${Helpers.capitalizeFirstLetter('qrafty')} Token Wallet Info:`}),
        Blocks.Divider(),
        Blocks.Section({ text: `Public Wallet Address: ${botWallet.publicWalletAddress}` }),
        Blocks.Section({ text: `Tokens In Wallet: ${botWallet.token.toLocaleString()}` }),
        Blocks.Section( gas ? { text: `Gas Available: ${gas.toLocaleString()}` } : undefined)
      ).asUser().buildToJSON();

      
  await say(theBlocks);
}

