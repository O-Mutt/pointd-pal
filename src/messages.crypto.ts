import _ from 'lodash';
import { Actions, Blocks, Elements, Md, Message } from 'slack-block-builder';
import tokenBuddy from 'token-buddy';

import { directMention, Logger } from '@slack/bolt';

import { app } from '../app';
import { Helpers as H } from './lib/helpers';
import { BotToken, IBotToken } from './entities/botToken';
import { User } from './entities/user';
import { regExpCreator } from './lib/regexpCreator';
import { connectionFactory } from './lib/services/connectionsFactory';
import { DatabaseService } from './lib/services/database';
import { actions } from './lib/types/Actions';
import { ConfirmOrCancel } from './lib/types/Enums';

require('dotenv').config();
const procVars = H.getProcessVariables(process.env);
const databaseService = new DatabaseService();

app.message(regExpCreator.getBotWallet(), directMention(), botWalletCount);

// DM only
app.message(regExpCreator.createLevelUpAccount(), directMention(), levelUpAccount);

app.action('confirm_levelup', levelUpToLevelThree);

async function levelUpAccount({ message, context, logger, say }) {
  if (!H.isPrivateMessage(message.channel)) {
    return await say(`You should only execute a level up from within the context of a DM with PointdPal`);
  }
  const teamId = context.teamId as string;

  const connection = connectionFactory(teamId);
  const user = await User(connection).findOneBySlackIdOrCreate(teamId, message.user);
  if (user.accountLevel === 2) {
    const theBlocks = Message({ channel: context.channel, text: "Let's level you up!" })
      .blocks(
        Blocks.Section({
          text: `You are already Level 2, ${Md.user(
            user.slackId,
          )}. It looks as if you are ready for Level 3 where you can deposit/withdraw ${H.capitalizeFirstLetter(
            'pointdPal',
          )} Tokens!`,
        }),
        Blocks.Actions({}).elements(
          Elements.Button({
            text: 'Confirm',
            actionId: actions.wallet.level_up_confirm,
            value: ConfirmOrCancel.CONFIRM,
          }).primary(),
          Elements.Button({
            text: 'Cancel',
            actionId: actions.wallet.level_up_cancel,
            value: ConfirmOrCancel.CANCEL,
          }).danger(),
        ),
      )
      .asUser();

    await say({ blocks: theBlocks.getBlocks() });
    return;
  }

  const leveledUpUser = await databaseService.updateAccountLevelToTwo(user);
  logger.debug('DB results', leveledUpUser);

  await say(
    `${Md.user(
      user.slackId,
    )}, we are going to level up your account to Level 2! This means you will start getting ${H.capitalizeFirstLetter(
      'pointdPal',
    )} Tokens as well as points!`,
  );
}

async function levelUpToLevelThree({ action, body, logger, ack, say }) {
  await ack();
  logger.debug('do some dang level up to three things!');
  await say(`We aren't quite ready for level three but we will note your response and get back to you asap: ${action}`);
}

async function botWalletCount({ message, context, logger, say }) {
  const teamId = context.teamId as string;
  const botWallet = await BotToken.findOne({}).exec();
  if (!botWallet) {
    return;
  }
  logger.debug(`Get the bot wallet by user ${message.user.name}, ${botWallet}`);
  let gas;
  try {
    gas = await tokenBuddy.getBalance(botWallet.publicWalletAddress);
  } catch (e) {
    await say(`An error occurred getting PointdPal's gas amount`, e);
  }
  logger.debug(
    `Get the bot wallet by user ${message.user.name}, ${_.pick(JSON.stringify(botWallet), [
      'publicWalletAddress',
      'name',
      'token',
    ])}`,
  );

  const theBlocks = Message({ channel: context.channel, text: `PointdPal Wallet:` })
    .blocks(
      Blocks.Section({ text: `PointdPal Token Wallet Info:` }),
      Blocks.Divider(),
      Blocks.Section({ text: `Public Wallet Address: ${botWallet.publicWalletAddress}` }),
      Blocks.Section({ text: `Tokens In Wallet: ${botWallet.token.toLocaleString()}` }),
      Blocks.Section(gas ? { text: `Gas Available: ${gas.toLocaleString()}` } : undefined),
    )
    .asUser();

  await say({ blocks: theBlocks.getBlocks() });
}
