import { WebClient } from '@slack/web-api';
import { View } from '@slack/types';
import { Actions, Appendable, Bits, Blocks, Elements, HomeTab, Md, Modal, ViewBlockBuilder } from 'slack-block-builder';
import { app } from '../app';
import { BonuslyBotConfig, IBonuslyBotConfig } from './lib/models/bonusly';
import { IUser, User } from './lib/models/user';
import { connectionFactory } from './lib/services/connectionsFactory';
import { EnabledSettings, PromptSettings } from './lib/types/Enums';
import { BotToken, IBotToken } from './lib/models/botToken';
import { actions } from './lib/types/Actions';
import {
  AllMiddlewareArgs,
  BlockAction,
  BlockButtonAction,
  Middleware,
  SlackAction,
  SlackActionMiddlewareArgs,
  SlackViewMiddlewareArgs,
  ViewSubmitAction,
} from '@slack/bolt';

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

    const hometab = HomeTab({ callbackId: 'hometab' }).blocks(
      Blocks.Section({
        text: `${Md.emoji('wave')} Hey ${Md.user(userId)}, I'm Qrafty.`,
      }),
      Blocks.Section({
        text: `I make it ${Md.italic('super')} easy to send a quick ${
          Md.codeInline('++') + ' or ' + Md.codeInline('--')
        } to your friends/coworkers via slack to show them that you appreciate all the work they do.`,
      }),
      Blocks.Actions().elements(
        Elements.Button({ text: 'Manage App Settings', actionId: actions.hometab.settings }).primary(),
      ),
      Blocks.Divider(),

      //...getBonuslyAdminConfigSection(user, bonusly, qraftyConfig),
      //...getBonuslyConfigSection(user, bonusly),
    );
    const result = await client.views.publish({ view: hometab.buildToObject() as View, user_id: userId });
  } catch (e) {
    logger.error('error publishing hometab', e);
  }
}

app.action(
  actions.hometab.settings,
  async (actionArgs: SlackActionMiddlewareArgs<BlockButtonAction> & AllMiddlewareArgs) => {
    await actionArgs.ack();
    const teamId = actionArgs.context.teamId;
    const userId = actionArgs.body.user.id;
    const connection = connectionFactory(teamId);
    const bonusly = await BonuslyBotConfig(connection).findOne().exec();
    console.log('main query', bonusly?.enabled);

    const user = await User(connection).findOneBySlackIdOrCreate(userId);
    const qraftyConfig = await BotToken().findOne().exec();

    /*if (!user.isAdmin) {
    return; //empty section because the user isn't an admin
  }*/
    const adminSettingsModal = Modal({
      title: `${Md.emoji('gear')} Qrafty Settings`,
      submit: 'Update Settings',
      callbackId: actions.hometab.settings_submit,
    }).blocks(
      Blocks.Header({ text: `${Md.emoji('rocket')} Bonusly Integration` }),
      Blocks.Actions().elements(
        Elements.StaticSelect({ actionId: 'hometab_bonuslyEnabled' })
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
      Blocks.Input({ label: `${Md.emoji('page_facing_up')} Bonusly API Uri` }).element(
        Elements.TextInput({
          actionId: 'hometab_bonuslyUri',
          placeholder: 'https://bonus.ly/api/v1',
          minLength: 8,
          initialValue: bonusly?.url?.toString() || '',
        }),
      ),
      Blocks.Input({ label: `${Md.emoji('key')} Bonusly API Key` }).element(
        Elements.TextInput({
          actionId: 'hometab_bonuslyAPIKey',
          minLength: 5,
          initialValue: bonusly?.apiKey || '',
        }),
      ),
      Blocks.Divider(),
      Blocks.Header({ text: 'Qrafty Token (Crypto)' }),
      Blocks.Actions().elements(
        Elements.StaticSelect({ actionId: 'hometab_qraftyTokenEnabled' })
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
    );

    const result = await actionArgs.client.views.open({
      trigger_id: actionArgs.body.trigger_id,
      view: adminSettingsModal.buildToObject() as View,
    });
  },
);

app.view(
  actions.hometab.settings_submit,
  async (args: SlackViewMiddlewareArgs<ViewSubmitAction> & AllMiddlewareArgs) => {
    await args.ack();
    const teamId = args.context.teamId;
    const userId = args.body.user.id;
    const bonusly = await BonuslyBotConfig(connectionFactory(teamId)).findOneOrCreate();
    for (const option in args.view.state.values) {
      for (const key in args.view.state.values[option]) {
        const value: string = (args.view.state.values[option][key].value ||
          args.view.state.values[option][key].selected_option?.value) as string;
        switch (key) {
          case 'hometab_bonuslyEnabled': {
            bonusly.enabled = value === EnabledSettings.ENABLED;
            break;
          }
          case 'hometab_bonuslyUri': {
            try {
              bonusly.url = new URL(value);
            } catch (e) {
              args.logger.warn('There was an error thrown when trying to set the bonusly url');
            }
            break;
          }
          case 'hometab_bonuslyAPIKey': {
            bonusly.apiKey = value;
            break;
          }
          case 'homeTab_qraftyTokenEnabled': {
            break;
          }
          default: {
            args.logger.debug('key not recognized');
            break;
          }
        }
      }
    }
    bonusly.updatedBy = userId;
    bonusly.updatedAt = new Date();
    args.logger.debug(`Updating admin configs for ${teamId} by ${userId}`);
    await bonusly.save();
  },
);

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
      Elements.StaticSelect({ actionId: 'hometab_bonuslyPrompt' })
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
          actionId: 'hometab_bonuslyScoreOverride',
          initialValue: user?.bonuslyScoreOverride?.toString() || '1',
        }),
      ),
  );
  return blocks;
}
