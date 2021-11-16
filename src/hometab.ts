import { Appendable, Blocks, Elements, HomeTab, Md, ViewBlockBuilder } from 'slack-block-builder';

import { AllMiddlewareArgs, SlackEventMiddlewareArgs } from '@slack/bolt';
import { View } from '@slack/types';

import { app } from '../app';
import { BonuslyConfig, IBonuslyConfig } from './lib/models/bonuslyConfig';
import { IPointdPalConfig, PointdPalConfig } from './lib/models/pointdPalConfig';
import { IUser, User } from './lib/models/user';
import { connectionFactory } from './lib/services/connectionsFactory';
import { actions } from './lib/types/Actions';

app.event('app_home_opened', updateHomeTab);

async function updateHomeTab({ event, context, client, logger }: SlackEventMiddlewareArgs<'app_home_opened'> & AllMiddlewareArgs) {
  logger.debug('app home was opened!');
  try {
    const userId = event.user;
    const teamId = context.teamId as string;

    const connection = connectionFactory(teamId);
    const user = await User(connection).findOneBySlackIdOrCreate(teamId, userId);
    const pointdPalConfig = await PointdPalConfig(connection).findOneOrCreate(teamId as string);

    const hometab = HomeTab({ callbackId: 'hometab' }).blocks(
      Blocks.Image({ altText: 'PointdPal!', imageUrl: 'https://okeefe.dev/cdn_images/pointdPal_header.png' }),
      Blocks.Section({
        text: `${Md.emoji('wave')} Hey ${Md.user(userId)}, I'm PointdPal.`,
      }),
      Blocks.Section({
        text: `I make it ${Md.italic('super')} easy to send a quick ${Md.codeInline('++') + ' or ' + Md.codeInline('--')
          } to your friends/coworkers via slack to show them that you appreciate all the work they do.`,
      }),
      Blocks.Divider(),
      ...getAdminConfigSection(user),
      ...getUserConfigSection(user, pointdPalConfig),

      //...getBonuslyAdminConfigSection(user, bonusly, pointdPalConfig),
    );
    await client.views.publish({ token: context.botToken, view: hometab.buildToObject() as View, user_id: userId });
  } catch (e) {
    logger.error('error publishing hometab', e);
  }
}

function getAdminConfigSection(user: IUser): Appendable<ViewBlockBuilder> {
  const blocks: Appendable<ViewBlockBuilder> = [];
  if (!user.isAdmin) {
    return blocks;
  }

  blocks.push(
    Blocks.Header({ text: 'PointdPal Admin' }),
    Blocks.Section({
      text: ':warning: This is where you can enable various integrations and setup how PointdPal notifies the world. Tread lightly.',
    }).accessory(
      Elements.Button({ text: 'PointdPal App Admin Settings', actionId: actions.hometab.admin_settings }).primary(),
    ),
    Blocks.Section({
      text: `${Md.emoji('recycle')} Sync Admins`,
    }).accessory(
      Elements.Button({ text: 'Sync', actionId: actions.hometab.sync_admins }).primary(),
    ),
    Blocks.Divider(),
  );
  return blocks;
}

function getUserConfigSection(user: IUser, pointdPalConfig: IPointdPalConfig | null): Appendable<ViewBlockBuilder> {
  const blocks: Appendable<ViewBlockBuilder> = [];

  blocks.push(
    Blocks.Header({ text: 'PointdPal Configuration' }),
    Blocks.Section({ text: 'You can configure PointdPal in a few different ways, check it out.' }).accessory(
      Elements.Button({ text: 'PointdPal Settings', actionId: actions.hometab.user_settings }).primary(),
    ),
  );
  return blocks;
}
