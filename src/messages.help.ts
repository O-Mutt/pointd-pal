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
  await say(`Qrafty ${pjson.name}, version: ${pjson.version}`);
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
    const resp = await axios({
      url: 'https://api.coindesk.com/v1/bpi/currentprice/ARS.json',
    });

    const bitcoin = resp.data.bpi.USD.rate_float;
    const ars = resp.data.bpi.ARS.rate_float;
    const satoshi = bitcoin / 1e8;
    return say(
      `A bitcoin is worth ${bitcoin} USD right now(${ars} ARS), a satoshi is about ${satoshi}, and qrafty points are worth nothing!`,
    );
  } catch (e: any) {
    return await say(
      "Seems like we are having trouble getting some data... Don't worry, though, your qrafty points are still worth nothing!",
    );
  }
}