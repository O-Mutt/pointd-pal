import {
  Appendable, Bits, Blocks, Elements, Md, Modal, ViewBlockBuilder
} from 'slack-block-builder';

import { AllMiddlewareArgs, BlockButtonAction, SlackActionMiddlewareArgs } from '@slack/bolt';
import { View } from '@slack/types';

import { app } from '../app';
import { BonuslyBotConfig } from './lib/models/bonusly';
import { BotToken } from './lib/models/botToken';
import { User } from './lib/models/user';
import { connectionFactory } from './lib/services/connectionsFactory';
import { actions } from './lib/types/Actions';
import { EnabledSettings, PromptSettings } from './lib/types/Enums';
import { QraftyConfig } from './lib/models/qraftyConfig';

app.action(
  actions.hometab.admin_settings,
  async (actionArgs: SlackActionMiddlewareArgs<BlockButtonAction> & AllMiddlewareArgs) => {
    await actionArgs.ack();
    const teamId = actionArgs.context.teamId;
    const userId = actionArgs.body.user.id;
    const connection = connectionFactory(teamId);
    const bonusly = await BonuslyBotConfig(connection).findOne().exec();
    const user = await User(connection).findOneBySlackIdOrCreate(userId);
    const qraftyConfig = await QraftyConfig(connection).findOne().exec();

    /*if (!user.isAdmin) {
    return; //empty section because the user isn't an admin
  }*/
    const adminSettingsModal = Modal({
      title: `${Md.emoji('gear')} Qrafty Settings`,
      submit: 'Update Settings',
      callbackId: actions.hometab.admin_settings_submit,
    }).blocks(
      Blocks.Header({ text: 'Basic Settings' }),
      Blocks.Input({ label: 'Company Name' }).element(
        Elements.TextInput({
          actionId: 'hometab_qraftyCompanyName',
          placeholder: 'Company Name',
          minLength: 2,
          initialValue: qraftyConfig?.companyName || '',
        }),
      ),
      Blocks.Divider(),
      Blocks.Header({ text: `${Md.emoji('rocket')} Bonusly Integration` }),
      Blocks.Input({ label: 'Bonusly Enabled' }).element(
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
      Blocks.Header({ text: 'Qrypto' }),
      Blocks.Input({ label: 'Qrypto (Crypto) Enabled' }).element(
        Elements.StaticSelect({ actionId: 'hometab_qraftyTokenEnabled' })
          .initialOption(
            Bits.Option({
              text: qraftyConfig?.qryptoEnabled ? EnabledSettings.ENABLED : EnabledSettings.DISABLED,
              value: qraftyConfig?.qryptoEnabled ? EnabledSettings.ENABLED : EnabledSettings.DISABLED,
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

app.action(
  actions.hometab.user_settings,
  async (actionArgs: SlackActionMiddlewareArgs<BlockButtonAction> & AllMiddlewareArgs) => {
    await actionArgs.ack();
    const teamId = actionArgs.context.teamId;
    const userId = actionArgs.body.user.id;
    const connection = connectionFactory(teamId);
    const bonusly = await BonuslyBotConfig(connection).findOne().exec();

    const user = await User(connection).findOneBySlackIdOrCreate(userId);
    console.log('user settings', teamId, userId, user);
    const qraftyConfig = await BotToken().findOne().exec();

    let bonuslyBlocks: Appendable<ViewBlockBuilder> = [];
    if (bonusly?.enabled) {
      bonuslyBlocks = [
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
        }).element(
          Elements.TextInput({
            actionId: 'hometab_bonuslyScoreOverride',
            initialValue: user?.bonuslyScoreOverride?.toString() || '1',
          }),
        ),
      ];
    }

    let bonuslyCryptoBlocks: Appendable<ViewBlockBuilder> = [];
    if (qraftyConfig?.enabled) {
      bonuslyCryptoBlocks = [
        Blocks.Header({ text: 'Qrafty Token (Crypto)' }),
        Blocks.Divider(),
        Blocks.Input({
          label: `When you level up your account we will need your wallet public address \
for you to be able to withdraw your crypto. What is your public BEP20 wallet address?`,
        }).element(
          Elements.TextInput({
            actionId: 'hometab_cryptoWalletAddress',
            initialValue: user?.walletAddress || '',
          }),
        ),
      ];
    }

    const userSettingsModal = Modal({
      title: `${Md.emoji('gear')} Qrafty Settings`,
      submit: 'Update Settings',
      callbackId: actions.hometab.user_settings_submit,
    }).blocks(...bonuslyBlocks, ...bonuslyCryptoBlocks, Blocks.Section({ text: 'Hello world' }));

    const result = await actionArgs.client.views.open({
      trigger_id: actionArgs.body.trigger_id,
      view: userSettingsModal.buildToObject() as View,
    });
  },
);
