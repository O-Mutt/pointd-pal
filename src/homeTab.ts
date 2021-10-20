import { WebClient } from '@slack/web-api';
import { View } from '@slack/types';
import { Appendable, Bits, Blocks, Elements, HomeTab, Md, ViewBlockBuilder } from 'slack-block-builder';
import { app } from '../app';
import { BonuslyBotConfig, IBonuslyBotConfig } from './lib/models/bonusly';
import { IUser, User } from './lib/models/user';
import { connectionFactory } from './lib/services/connectionsFactory';
import { Settings } from './lib/types/settings';

app.event('app_home_opened', updateHomeTab);

async function updateHomeTab({ payload, event, logger, client }) {
  logger.debug('app home was opened!');
  try {
    const userId = event.user;
    const teamId = payload.team_id;

    const connection = connectionFactory(teamId);
    const bonusly = (await BonuslyBotConfig(connection).findOne({ enabled: true }).exec()) as IBonuslyBotConfig;
    const user = await User(connection).findOneBySlackIdOrCreate(teamId, userId);

    const derp: WebClient = client as WebClient;
    const hometab = HomeTab({ callbackId: 'homeTab' }).blocks(
      Blocks.Header({
        text: `${Md.emoji('wave')} Hey ${Md.user(userId)}, I'm Qrafty. I make it ${Md.italic(
          'super',
        )} easy to send a quick 
    ${Md.codeInline('++')} or ${Md.codeInline('--')} to your friends/coworkers via slack.`,
      }),
      ...getBonuslyAdminConfigSection(user, bonusly),
    );
    const result = await derp.views.publish({ view: hometab.buildToObject() as View, user_id: userId });
  } catch (e) {
    logger.error('error publishing hometab', e);
  }
}

function getBonuslyAdminConfigSection(user: IUser, bonusly: IBonuslyBotConfig): Appendable<ViewBlockBuilder> {
  const blocks: Appendable<ViewBlockBuilder> = [];
  if (!user.isAdmin) {
    return blocks; //empty section because the user isn't an admin
  }
  blocks.push(
    Blocks.Divider(),
    Blocks.Header({ text: `Admin Configurations` }),
    Blocks.Divider(),
    Blocks.Section({ text: 'Bonusly Config' }),
    Blocks.Actions({ blockId: 'homeTab_bonuslyAdminConfig' }).elements(
      Elements.StaticSelect({ actionId: 'homeTab_bonuslyEnabled ' }).options(
        Bits.Option({ text: 'Enabled', value: Settings.ENABLED }),
        Bits.Option({ text: 'Disabled', value: Settings.DISABLED }),
      ),
    ),
    Blocks.Input({ label: 'Bonusly API Uri' }).element(
      Elements.TextInput({ actionId: 'homeTab_bonuslyUri', placeholder: 'https://bonus.ly/api/v1' }),
    ),
    Blocks.Input({ label: 'Bonusly API Key' }).element(Elements.TextInput({ actionId: 'homeTab_bonuslyAPIKey' })),
    Blocks.Divider(),
    Blocks.Section({ text: 'Qrafty Token (Crypto)' }),
    Blocks.Actions({ blockId: 'homeTab_adminTokenConfig' }).elements(
      Elements.StaticSelect({ actionId: 'homeTab_qraftyTokenEnabled ' }).options(
        Bits.Option({ text: 'Enabled', value: Settings.ENABLED }),
        Bits.Option({ text: 'Disabled', value: Settings.DISABLED }),
      ),
    ),
  );

  return blocks;
}
