import { Appendable, Blocks, Elements, HomeTab, Md, ViewBlockBuilder } from 'slack-block-builder';

import { AllMiddlewareArgs, SlackEventMiddlewareArgs } from '@slack/bolt';
import { View } from '@slack/types';

import { app } from '../app';
import { BonuslyBotConfig, IBonuslyBotConfig } from './lib/models/bonusly';
import { QraftyConfig } from './lib/models/qraftyConfig';
import { IUser, User } from './lib/models/user';
import { connectionFactory } from './lib/services/connectionsFactory';
import { actions } from './lib/types/Actions';

app.event('app_home_opened', updateHomeTab);

async function updateHomeTab(args: SlackEventMiddlewareArgs<'app_home_opened'> & AllMiddlewareArgs) {
  args.logger.debug('app home was opened!');
  try {
    const userId = args.event.user;
    const teamId = args.context.teamId;

    const connection = connectionFactory(teamId);
    const bonusly = await BonuslyBotConfig(connection).findOne().exec();
    console.log('main query bonusly', teamId, bonusly?.enabled);

    const user = await User(connection).findOneBySlackIdOrCreate(userId);
    const qraftyConfig = await QraftyConfig(connection).findOne().exec();

    const hometab = HomeTab({ callbackId: 'hometab' }).blocks(
      Blocks.Section({
        text: `${Md.emoji('wave')} Hey ${Md.user(userId)}, I'm Qrafty.`,
      }),
      Blocks.Section({
        text: `I make it ${Md.italic('super')} easy to send a quick ${Md.codeInline('++') + ' or ' + Md.codeInline('--')
          } to your friends/coworkers via slack to show them that you appreciate all the work they do.`,
      }),
      Blocks.Divider(),
      ...getAdminConfigSection(user),
      ...getUserConfigSection(user, bonusly),

      //...getBonuslyAdminConfigSection(user, bonusly, qraftyConfig),
    );
    const result = await args.client.views.publish({ view: hometab.buildToObject() as View, user_id: userId });
  } catch (e) {
    args.logger.error('error publishing hometab', e);
  }
}

function getAdminConfigSection(user: IUser): Appendable<ViewBlockBuilder> {
  const blocks: Appendable<ViewBlockBuilder> = [];
  if (!user.isAdmin) {
    return blocks;
  }

  blocks.push(
    Blocks.Header({ text: 'Qrafty Admin' }),
    Blocks.Section({
      text: ':warning: This is where you can enable various integrations and setup how Qrafty notifies the world. Tread lightly.',
    }).accessory(
      Elements.Button({ text: 'Qrafty App Admin Settings', actionId: actions.hometab.admin_settings }).primary(),
    ),
    Blocks.Divider(),
  );
  return blocks;
}

function getUserConfigSection(user: IUser, bonusly: IBonuslyBotConfig | null): Appendable<ViewBlockBuilder> {
  const blocks: Appendable<ViewBlockBuilder> = [];

  blocks.push(
    Blocks.Header({ text: 'Qrafty Configuration' }),
    Blocks.Section({ text: 'You can configure Qrafty in a few different ways, check it out.' }).accessory(
      Elements.Button({ text: 'Qrafty Settings', actionId: actions.hometab.user_settings }).primary(),
    ),
  );
  return blocks;
}
