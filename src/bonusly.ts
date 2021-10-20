import { app } from '../app';
import { Helpers } from './lib/helpers';
import { BonuslyBotConfig } from './lib/models/bonusly';
import { connectionFactory } from './lib/services/connectionsFactory';

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

app.action('homeTab_bonuslyEnabled', handleBonuslyEnabled);
app.action('homeTab_bonuslyUri', handleBonuslyUri);

async function handleBonuslyEnabled({ body, client, logger, ack }) {
  await ack();
  body.actions;
  const teamId = body.team.id;
  const bonusly = await BonuslyBotConfig(connectionFactory(teamId)).findOneOrCreate();
  bonusly.enabled = true;
  bonusly.save();
}

async function handleBonuslyUri({ body, client, logger, ack }) {
  await ack();
  const teamId = body.team.id;
  // body.action.homeTab_bonuslyUri.value;
  logger.debug('handle bonusly uri', body);
  const bonusly = await BonuslyBotConfig(connectionFactory(teamId)).findOneOrCreate();
  bonusly.enabled = true;
}
