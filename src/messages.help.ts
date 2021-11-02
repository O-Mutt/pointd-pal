import axios from 'axios';
import { Blocks, Md, Message } from 'slack-block-builder';

import { directMention } from '@slack/bolt';
import { ChatPostMessageArguments } from '@slack/web-api';

import { app } from '../app';
import * as pjson from '../package.json';
import { Helpers } from './lib/helpers';
import { regExpCreator } from './lib/regexpCreator';

app.message(regExpCreator.getHelp(), directMention(), respondWithHelpGuidance);
app.message(RegExp(/(plusplus version|-v|--version)/, 'i'), directMention(), async ({ message, context, say }) => {
  await say(`Qrafty Version: _${pjson.version}_`);
});
app.message(new RegExp('how much .*point.*', 'i'), tellHowMuchPointsAreWorth);

const procVars = Helpers.getProcessVariables(process.env);


async function respondWithHelpGuidance({ client, message, say }) {
  const helpMessage = ''
    .concat('`< name > ++[<reason>]` - Increment score for a name (for a reason)\n')
    .concat('`< name > --[<reason>]` - Decrement score for a name (for a reason)\n')
    .concat('`{ name1, name2, name3 } ++[<reason>]` - Increment score for all names (for a reason)\n')
    .concat('`{ name1, name2, name3 } --[<reason>]` - Decrement score for all names (for a reason) \n')
    .concat('`{ name1, name2, name3 } --[<reason>]` - Decrement score for all names (for a reason) \n')
    .concat(`\`@Qrafty score <name>\` - Display the score for a name and some of the reasons\n`)
    .concat(`\`@Qrafty top <amount>\` - Display the top scoring <amount>\n`)
    .concat(`\`@Qrafty erase <name> [<reason>]\` - Remove the score for a name (for a reason) \n`)
    .concat(`\`@Qrafty level me up\` - Level up your account for some additional Qraftyiness \n`)
    .concat('`how much are <point_type> points worth` - Shows how much <point_type> points are worth\n');

  const theMessage = Message({ channel: message.channel, text: 'Help menu for Qrafty' })
    .blocks(
      Blocks.Header({ text: `Need help with Qrafty?` }),
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

async function tellHowMuchPointsAreWorth({ payload, logger, message, context, say }) {
  logger.error(message, context, payload);
  try {
    const { data: eth } = await axios({
      url: 'https://api.coinbase.com/v2/exchange-rates?currency=ETH',
    });

    const { data: btc } = await axios({
      url: 'https://api.coinbase.com/v2/exchange-rates?currency=BTC',
    });

    console.log(eth);
    const ethInUsd = eth.rates.USD;
    const btcInUsd = btc.rates.USD;
    return say(
      `A Bitcoin is worth $${btcInUsd} USD right now, Ethereum is $${ethInUsd} USD, and ${Md.bold('Qrafty points are worth nothing')}!`,
    );
  } catch (e: any) {
    console.error(e);
    return await say(
      "Seems like we are having trouble getting some data... Don't worry, though, your Qrafty points are still worth nothing!",
    );
  }
}