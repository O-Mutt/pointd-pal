import { app } from '../app';
import { Helpers } from './lib/helpers';
import { BonuslyBotConfig } from './lib/models/bonusly';
import { User } from './lib/models/user';
import { connectionFactory } from './lib/services/connectionsFactory';
import { EnabledSettings, PromptSettings } from './lib/types/Enums';

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

// user config
app.action('hometab_bonuslyScoreOverride', handleUserBonusScoreOverride);
app.action('hometab_bonuslyPrompt', handleUserBonusPrompt);

async function handleBonuslyEnabled({ body, client, logger, ack }) {
  await ack();
  body.actions;
  const teamId = body.team.id;
  const isEnabled: boolean = body.actions[0].selected_option.value === EnabledSettings.ENABLED;
  console.log('handle bonusly enabled', isEnabled);
  const bonusly = await BonuslyBotConfig(connectionFactory(teamId)).findOneOrCreate();
  bonusly.enabled = isEnabled;
  await bonusly.save();
}

async function handleBonuslyUri({ body, client, logger, ack }) {
  await ack();
  const teamId = body.team.id;
  let uri;
  console.log('handle bonusly uri', body, body.actions[0].value);
  try {
    uri = new URL(body.actions[0].value);
  } catch (e) {
    logger.error('failed to set url because it isn\t a valid url');
  }

  console.log('handle bonusly uri', body, uri);
  logger.debug('handle bonusly uri', body);
  const bonusly = await BonuslyBotConfig(connectionFactory(teamId)).findOneOrCreate();
  bonusly.url = uri;
  await bonusly.save();
}

async function handleBonuslyApiKey({ body, client, logger, ack }) {
  await ack();
  const teamId = body.team.id;
  const apiKey: string = body.actions[0].value;
  logger.debug('handle bonusly uri', body);
  const bonusly = await BonuslyBotConfig(connectionFactory(teamId)).findOneOrCreate();
  bonusly.apiKey = apiKey;
  await bonusly.save();
}

async function handleUserBonusScoreOverride({ body, client, logger, ack }) {
  await ack();
  const userId = body.user.id;
  const teamId = body.team.id;
  const scoreOverride: number = body.actions[0].value;
  //console.log('handle bonusly api key', body, apiKey);
  logger.debug('handle bonusly uri', body);
  const user = await User(connectionFactory(teamId)).findOneBySlackIdOrCreate(userId);
  user.bonuslyScoreOverride = scoreOverride;
  await user.save();
}

async function handleUserBonusPrompt({ body, client, logger, ack }) {
  await ack();
  const userId = body.user.id;
  const teamId = body.team.id;
  const promptSetting: PromptSettings = body.actions[0].selected_option.value;
  //console.log('handle bonusly api key', body, apiKey);
  logger.debug('handle bonusly uri', body);
  const user = await User(connectionFactory(teamId)).findOneBySlackIdOrCreate(userId);
  user.bonuslyPrompt = promptSetting;
  await user.save();
}
