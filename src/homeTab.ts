import { WebClient } from '@slack/web-api';
import { View } from '@slack/types';
import { Appendable, Bits, Blocks, Elements, HomeTab, Md, ViewBlockBuilder } from 'slack-block-builder';
import { app } from '../app';
import { BonuslyBotConfig, IBonuslyBotConfig } from './lib/models/bonusly';
import { IUser, User } from './lib/models/user';
import { connectionFactory } from './lib/services/connectionsFactory';
import { EnabledSettings, PromptSettings } from './lib/types/Enums';
import { BotToken, IBotToken } from './lib/models/botToken';

app.event('app_home_opened', updateHomeTab);

async function updateHomeTab({ payload, event, logger, client }) {
  logger.debug('app home was opened!');
  try {
    const userId = event.user;
    const teamId = payload.team_id;

    const connection = connectionFactory(teamId);
    const bonusly = await BonuslyBotConfig(connection).findOne().exec();
    console.log('main query', bonusly?.enabled);

    const user = await User(connection).findOneBySlackIdOrCreate(userId);
    const qraftyConfig = await BotToken().findOne().exec();

    const hometab = HomeTab({ callbackId: 'homeTab' }).blocks(
      Blocks.Section({
        text: `${Md.emoji('wave')} Hey ${Md.user(userId)}, I'm Qrafty.`,
      }),
      Blocks.Section({
        text: `I make it ${Md.italic('super')} easy to send a quick ${
          Md.codeInline('++') + ' or ' + Md.codeInline('--')
        } to your friends/coworkers via slack to show them that you appreciate all the work they do.`,
      }),
      ...getBonuslyAdminConfigSection(user, bonusly, qraftyConfig),
      ...getBonuslyConfigSection(user, bonusly),
    );
    const result = await client.views.publish({ view: hometab.buildToObject() as View, user_id: userId });
  } catch (e) {
    logger.error('error publishing hometab', e);
  }
}

function getBonuslyAdminConfigSection(
  user: IUser,
  bonusly: IBonuslyBotConfig | null,
  qraftyConfig: IBotToken | null,
): Appendable<ViewBlockBuilder> {
  const blocks: Appendable<ViewBlockBuilder> = [];
  console.log(bonusly?.enabled);
  /*if (!user.isAdmin) {
    return blocks; //empty section because the user isn't an admin
  }*/
  blocks.push(
    Blocks.Divider(),
    Blocks.Header({ text: `${Md.emoji('gear')} Admin Configuration` }),
    Blocks.Divider(),
    Blocks.Header({ text: `${Md.emoji('rocket')} Bonusly Integration` }),
    Blocks.Actions().elements(
      Elements.StaticSelect({ actionId: 'homeTab_bonuslyEnabled' })
        .initialOption(
          Bits.Option({
            text: bonusly?.enabled ? EnabledSettings.ENABLED : EnabledSettings.DISABLED,
            value: bonusly?.enabled ? EnabledSettings.ENABLED : EnabledSettings.DISABLED,
          }),
        )
        .options(
          Bits.Option({ text: EnabledSettings.ENABLED, value: EnabledSettings.ENABLED }),
          Bits.Option({ text: EnabledSettings.DISABLED, value: EnabledSettings.DISABLED }),
        ),
    ),
    Blocks.Input({ label: `${Md.emoji('page_facing_up')} Bonusly API Uri` })
      .dispatchAction(true)
      .element(
        Elements.TextInput({
          actionId: 'homeTab_bonuslyUri',
          placeholder: 'https://bonus.ly/api/v1',
          minLength: 8,
          initialValue: bonusly?.url?.toString() || ' ',
        }),
      ),
    Blocks.Input({ label: `${Md.emoji('key')} Bonusly API Key` })
      .dispatchAction(true)
      .element(
        Elements.TextInput({
          actionId: 'homeTab_bonuslyAPIKey',
          minLength: 5,
          initialValue: bonusly?.apiKey || ' ',
        }),
      ),
    Blocks.Divider(),
    Blocks.Header({ text: 'Qrafty Token (Crypto)' }),
    Blocks.Actions().elements(
      Elements.StaticSelect({ actionId: 'homeTab_qraftyTokenEnabled ' })
        .initialOption(
          Bits.Option({
            text: qraftyConfig?.enabled ? EnabledSettings.ENABLED : EnabledSettings.DISABLED,
            value: qraftyConfig?.enabled ? EnabledSettings.ENABLED : EnabledSettings.DISABLED,
          }),
        )
        .options(
          Bits.Option({ text: EnabledSettings.ENABLED, value: EnabledSettings.ENABLED }),
          Bits.Option({ text: EnabledSettings.DISABLED, value: EnabledSettings.DISABLED }),
        ),
    ),
    Blocks.Divider(),
  );

  return blocks;
}

function getBonuslyConfigSection(user: IUser, bonusly: IBonuslyBotConfig | null): Appendable<ViewBlockBuilder> {
  const blocks: Appendable<ViewBlockBuilder> = [];
  if (bonusly?.enabled !== true) {
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
      Elements.StaticSelect({ actionId: 'homeTab_bonuslyPrompt' })
        .initialOption(
          user?.bonuslyPrompt
            ? Bits.Option({
                text: user?.bonuslyPrompt,
                value: user?.bonuslyPrompt,
              })
            : undefined,
        )
        .options(
          Bits.Option({ text: PromptSettings.ALWAYS, value: PromptSettings.ALWAYS }),
          Bits.Option({ text: PromptSettings.PROMPT, value: PromptSettings.PROMPT }),
          Bits.Option({ text: PromptSettings.NEVER, value: PromptSettings.NEVER }),
        ),
    ),
    Blocks.Input({
      label: `When we send a ${Md.codeInline('++')} \
and a bonusly is included what is the default amount that you would like to send?`,
    })
      .dispatchAction(true)
      .element(
        Elements.TextInput({
          actionId: 'homeTab_bonuslyScoreOverride',
          initialValue: user?.bonuslyScoreOverride?.toString() || '1',
        }),
      ),
  );
  return blocks;
}
