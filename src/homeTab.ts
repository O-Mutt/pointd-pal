import { WebClient } from '@slack/web-api';
import { View } from '@slack/types';
import { Appendable, Bits, Blocks, Elements, HomeTab, Md, ViewBlockBuilder } from 'slack-block-builder';
import { app } from '../app';
import { BonuslyBotConfig, IBonuslyBotConfig } from './lib/models/bonusly';
import { IUser, User } from './lib/models/user';
import { connectionFactory } from './lib/services/connectionsFactory';
import { EnabledSettings, PromptSettings } from './lib/types/settings';

app.event('app_home_opened', updateHomeTab);

async function updateHomeTab({ payload, event, logger, client }) {
  logger.debug('app home was opened!');
  try {
    const userId = event.user;
    const teamId = payload.team_id;

    const connection = connectionFactory(teamId);
    const bonusly = await BonuslyBotConfig(connection).findOne({}).exec();
    const user = await User(connection).findOneBySlackIdOrCreate(userId);

    const hometab = HomeTab({ callbackId: 'homeTab' }).blocks(
      Blocks.Section({
        text: `${Md.emoji('wave')} Hey ${Md.user(userId)}, I'm Qrafty. I make it ${Md.italic(
          'super',
        )} easy to send a quick 
    ${Md.codeInline('++')} or ${Md.codeInline('--')} to your friends/coworkers via slack.`,
      }),
      ...getBonuslyAdminConfigSection(user, bonusly),
      ...getBonuslyConfigSection(user, bonusly),
    );
    const result = await client.views.publish({ view: hometab.buildToObject() as View, user_id: userId });
  } catch (e) {
    logger.error('error publishing hometab', e);
  }
}

function getBonuslyAdminConfigSection(user: IUser, bonusly: IBonuslyBotConfig | null): Appendable<ViewBlockBuilder> {
  const blocks: Appendable<ViewBlockBuilder> = [];
  console.log(user);
  if (!user.isAdmin) {
    return blocks; //empty section because the user isn't an admin
  }
  blocks.push(
    Blocks.Divider(),
    Blocks.Header({ text: `Admin Configuration ${Md.emoji('gear')}` }),
    Blocks.Divider(),
    Blocks.Header({ text: 'Bonusly Config' }),
    Blocks.Actions({ blockId: 'homeTab_bonuslyAdminConfig' }).elements(
      Elements.StaticSelect({ actionId: 'homeTab_bonuslyEnabled' }).options(
        Bits.Option({ text: 'Enabled', value: EnabledSettings.ENABLED }),
        Bits.Option({ text: 'Disabled', value: EnabledSettings.DISABLED }),
      ),
    ),
    Blocks.Input({ label: 'Bonusly API Uri' }).element(
      Elements.TextInput({ actionId: 'homeTab_bonuslyUri', placeholder: 'https://bonus.ly/api/v1' }),
    ),
    Blocks.Input({ label: 'Bonusly API Key' }).element(Elements.TextInput({ actionId: 'homeTab_bonuslyAPIKey' })),
    Blocks.Divider(),
    Blocks.Header({ text: 'Qrafty Token (Crypto)' }),
    Blocks.Actions({ blockId: 'homeTab_adminTokenConfig' }).elements(
      Elements.StaticSelect({ actionId: 'homeTab_qraftyTokenEnabled ' }).options(
        Bits.Option({ text: 'Enabled', value: EnabledSettings.ENABLED }),
        Bits.Option({ text: 'Disabled', value: EnabledSettings.DISABLED }),
      ),
    ),
    Blocks.Divider(),
  );

  return blocks;
}

function getBonuslyConfigSection(user: IUser, bonusly: IBonuslyBotConfig | null): Appendable<ViewBlockBuilder> {
  const blocks: Appendable<ViewBlockBuilder> = [];
  if (bonusly && bonusly.enabled !== true) {
    return blocks;
  }

  blocks.push(
    Blocks.Header({ text: 'Bonusly Integration Settings' }),
    Blocks.Divider(),
    Blocks.Section({ text: 'Bonusly Config' }),
    Blocks.Input({
      label: `When sending a ${Md.codeInline('++')} \
we can also send a bonusly bonus. We can always send one, prompt you every time, or never send a bonus.`,
    }).element(
      Elements.StaticSelect({ actionId: 'homeTab_bonuslyPrompt' }).options(
        Bits.Option({ text: PromptSettings.ALWAYS, value: PromptSettings.ALWAYS }),
        Bits.Option({ text: PromptSettings.PROMPT, value: PromptSettings.PROMPT }),
        Bits.Option({ text: PromptSettings.NEVER, value: PromptSettings.NEVER }),
      ),
    ),
    Blocks.Input({
      label: `When we send a ${Md.codeInline('++')} \
and a bonusly is included what is the default amount that you would like to send?`,
    }).element(Elements.TextInput({ actionId: 'homeTab_bonuslyValue', initialValue: '1' })),
  );
  return blocks;
}
