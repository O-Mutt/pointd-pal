import _ from 'lodash';
import { Blocks, Elements, Message } from 'slack-block-builder';
import tokenBuddy from 'token-buddy';

import { directMention, Logger } from '@slack/bolt';

import { app } from '../app';
import { Helpers } from './lib/helpers';
import { IBotToken } from './lib/models/botToken';
import { regExpCreator } from './lib/regexpCreator';
import { DatabaseService } from './lib/services/database';

const procVars = Helpers.getProcessVariables(process.env);
const databaseService = new DatabaseService({ ...procVars });
enum ConfirmOrCancel {
  CONFIRM = 'confirm',
  CANCEL = 'cancel',
}

// directMention()
app.message(regExpCreator.getBotWallet(), botWalletCount);

// DM only
// directMention()
app.message(regExpCreator.createLevelUpAccount(), levelUpAccount);

app.action('confirm_levelup', levelUpToLevelThree);

async function levelUpAccount({ message, context, logger, say }) {
  if (!Helpers.isPrivateMessage(message.channel)) {
    return await say(`You should only execute a level up from within the context of a DM with ${'qrafty'}`);
  }
  const teamId = context.teamId;

  const user = await databaseService.getUser(teamId, message.user);
  if (user.accountLevel === 2) {
    const theBlocks = Message({ channel: context.channel, text: "Let's level you up!" })
      .blocks(
        Blocks.Section({
          text: `You are already Level 2, <@${user.slackId
            }>. It looks as if you are ready for Level 3 where you can deposit/withdraw ${Helpers.capitalizeFirstLetter(
              'qrafty',
            )} Tokens!`,
        }),
        Blocks.Actions().elements(
          Elements.Button({ text: 'Confirm', actionId: 'levelUp', value: ConfirmOrCancel.CONFIRM }).primary(),
          Elements.Button({ text: 'Cancel', actionId: 'levelUp', value: ConfirmOrCancel.CANCEL }).danger(),
        ),
      )
      .asUser();

    await say({ blocks: theBlocks.getBlocks() });
  }

  const leveledUpUser = await databaseService.updateAccountLevelToTwo(teamId, user);
  logger.debug('DB results', leveledUpUser);

  await say(
    `${user.name
    }, we are going to level up your account to Level 2! This means you will start getting ${Helpers.capitalizeFirstLetter(
      'qrafty',
    )} Tokens as well as points!`,
  );
}

async function levelUpToLevelThree({ action, body, logger, ack, say }) {
  await ack();
  logger.debug('do some dang level up to three things!');
  await say(`We aren't quite ready for level three but we will note your response and get back to you asap: ${action}`);
}

async function botWalletCount({ message, context, logger, say }) {
  const teamId = context.teamId;
  const botWallet: IBotToken = await databaseService.getBotWallet(teamId);
  logger.debug(`Get the bot wallet by user ${message.user.name}, ${botWallet}`);
  let gas;
  try {
    gas = await tokenBuddy.getBalance(botWallet.publicWalletAddress);
  } catch (e) {
    await say(`An error occurred getting ${'qrafty'}'s gas amount`);
  }
  logger.debug(
    `Get the bot wallet by user ${message.user.name}, ${_.pick(JSON.stringify(botWallet), [
      'publicWalletAddress',
      'name',
      'token',
    ])}`,
  );

  const theBlocks = Message({ channel: context.channel, text: `${Helpers.capitalizeFirstLetter('qrafty')} Wallet:` })
    .blocks(
      Blocks.Section({ text: `${Helpers.capitalizeFirstLetter('qrafty')} Token Wallet Info:` }),
      Blocks.Divider(),
      Blocks.Section({ text: `Public Wallet Address: ${botWallet.publicWalletAddress}` }),
      Blocks.Section({ text: `Tokens In Wallet: ${botWallet.token.toLocaleString()}` }),
      Blocks.Section(gas ? { text: `Gas Available: ${gas.toLocaleString()}` } : undefined),
    )
    .asUser();

  await say({ blocks: theBlocks.getBlocks() });
}
