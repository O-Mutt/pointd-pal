import { app } from '../app';
import { Helpers } from './lib/helpers';

const procVars = Helpers.getProcessVariables(process.env);

/*const integrationsModal = Modal({ title: 'Integration', submit: 'Save' })
  .blocks(
    Blocks.Section({ text: 'Hey! We can configure some integrations to go along with Qrafty. ' }),
    Blocks.Input({ label: 'Choose which integration should be turned on:' }).element(
      Elements.StaticMultiSelect({ actionId: 'integrations' }).options(
        Bits.Option({ text: `${Md.emoji('bonusly')} bonusly`, value: Integrations.BONUSLY }),
      ),
    ),
  )
  .buildToJSON();

app.message(regExpCreator.createBonuslySettings(), adminBonuslySettings);*/

app.action(/homeTab_bonusly.*/, handleHomeTabSettings);

async function handleHomeTabSettings({ body, client, logger, ack }) {
  await ack();
  logger.debug('caught the hometab_bonusly action', body);
}
