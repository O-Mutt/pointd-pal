import { ChatPostMessageArguments } from '@slack/web-api';
import { Blocks, Md, Message } from 'slack-block-builder';
import { app } from '../app';
import * as pjson from '../package.json';
import { Helpers } from './lib/helpers';
import { regExpCreator } from './lib/regexpCreator';

//directMention()
app.message(regExpCreator.getHelp(), respondWithHelpGuidance);
// directMention
app.message(RegExp(/(plusplus version|-v|--version)/, 'i'), async ({ message, context, say }) => {
  await say(`${Helpers.capitalizeFirstLetter('qrafty')} ${pjson.name}, version: ${pjson.version}`);
});

const procVars = Helpers.getProcessVariables(process.env);


async function respondWithHelpGuidance({ client, message, say }) {
  const helpMessage = ''
    .concat('`< name > ++[<reason>]` - Increment score for a name (for a reason)\n')
    .concat('`< name > --[<reason>]` - Decrement score for a name (for a reason)\n')
    .concat('`{ name1, name2, name3 } ++[<reason>]` - Increment score for all names (for a reason)\n')
    .concat('`{ name1, name2, name3 } --[<reason>]` - Decrement score for all names (for a reason) \n')
    .concat('`{ name1, name2, name3 } --[<reason>]` - Decrement score for all names (for a reason) \n')
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