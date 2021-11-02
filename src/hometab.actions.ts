import {
  Appendable, Bits, BlockBuilder, Blocks, Elements, Md, Modal, ModalBuilder, ViewBlockBuilder
} from 'slack-block-builder';

import { AllMiddlewareArgs, BlockButtonAction, BlockStaticSelectAction, SlackActionMiddlewareArgs } from '@slack/bolt';
import { View } from '@slack/types';

import { app } from '../app';
import { BonuslyConfig, IBonuslyConfig } from './lib/models/bonuslyConfig';
import { BotToken } from './lib/models/botToken';
import { IUser, User } from './lib/models/user';
import { connectionFactory } from './lib/services/connectionsFactory';
import { actions } from './lib/types/Actions';
import { EnabledSettings, PromptSettings } from './lib/types/Enums';
import { IQraftyConfig, QraftyConfig } from './lib/models/qraftyConfig';
import { blocks } from './lib/types/BlockIds';
import { ViewsUpdateArguments } from '@slack/web-api';

app.action(
  actions.hometab.admin_settings,
  async ({ ack, client, context, body }: SlackActionMiddlewareArgs<BlockButtonAction> & AllMiddlewareArgs) => {
    await ack();
    const teamId = context.teamId as string;
    const userId = body.user.id;
    const connection = connectionFactory(teamId);
    const user = await User(connection).findOneBySlackIdOrCreate(teamId, userId);
    const qraftyConfig = await QraftyConfig(connection).findOneOrCreate(teamId);

    if (!user.isAdmin || !qraftyConfig) {
      return; //empty section because the user isn't an admin
    }
    const adminSettingsModal = buildAdminModal(qraftyConfig).buildToObject();

    const result = await client.views.open({
      trigger_id: body.trigger_id,
      view: adminSettingsModal,
    });
  },
);

app.action(
  actions.hometab.user_settings,
  async ({ ack, client, context, body }: SlackActionMiddlewareArgs<BlockButtonAction> & AllMiddlewareArgs) => {
    await ack();
    let bonuslyBlocks: Appendable<ViewBlockBuilder> = [];
    const teamId = context.teamId as string;
    const userId = body.user.id;
    const connection = connectionFactory(teamId);
    const qraftyConfig = await QraftyConfig(connection).findOneOrCreate(teamId);

    const user = await User(connection).findOneBySlackIdOrCreate(teamId, userId);

    if (!user || !qraftyConfig || !qraftyConfig.bonuslyConfig) {
      return;
    }

    console.log('user for user settings', user)
    const userSettingsModal = Modal({
      title: `${Md.emoji('gear')} Qrafty Settings`,
      submit: 'Update Settings',
      callbackId: actions.hometab.user_settings_submit,
    }).blocks(
      ...buildBonuslyUserBlocks(qraftyConfig.bonuslyConfig, user),
      ...buildQryptoUserBlocks(qraftyConfig, user)
    );

    const result = await client.views.open({
      trigger_id: body.trigger_id,
      view: userSettingsModal.buildToObject() as View,
    });
  },
);

app.action(
  actions.hometab.sync_admins,
  async ({ ack, body, context }: SlackActionMiddlewareArgs<BlockButtonAction> & AllMiddlewareArgs) => {
    await ack();
    const teamId = context.teamId as string;
    const userId = body.user.id;
    const connection = connectionFactory(teamId);
    const user = await User(connection).findOneBySlackIdOrCreate(teamId, userId);
    const qraftyConfig = await QraftyConfig(connection).findOneOrCreate(teamId as string);

    if (!user.isAdmin) {
      return;
    }

    const { members } = await app.client.users.list({ team_id: teamId });
    const admins: string[] = members?.filter((user) => user.is_admin === true).map((admin) => admin.id as string) as string[];
    const users = await User(connection).find({ isAdmin: true }).exec();
    const adminUsers = users.map((admin) => admin.slackId);
    adminUsers.concat(admins);
    qraftyConfig.qraftyAdmins = adminUsers;
    await qraftyConfig.save();
    return;
  }
)

app.action(blocks.hometab.admin.bonusly.enabled,
  async ({ ack, client, body, context, action }: SlackActionMiddlewareArgs<BlockStaticSelectAction> & AllMiddlewareArgs) => {
    await ack();
    console.log('in the bonusly enabled action');
    const teamId = context.teamId as string;
    const connection = connectionFactory(teamId);
    const qraftyConfig = await QraftyConfig(connection).findOneOrCreate(teamId);

    const updatedView = buildAdminModal(qraftyConfig, action.selected_option.value === EnabledSettings.ENABLED).buildToObject();
    await client.views.update({
      view_id: body.view?.id,
      hash: body.view?.hash,
      view: updatedView
    } as ViewsUpdateArguments)
  }
);

function buildBonuslyAdminBlocks(bonuslyConfig: IBonuslyConfig | undefined, enabledOverride: boolean = false) {
  let blockBuilder: Appendable<BlockBuilder> = [];
  if (enabledOverride === true || bonuslyConfig?.enabled === true) {
    blockBuilder.push(
      Blocks.Input({ label: `${Md.emoji('page_facing_up')} Bonusly API Uri`, blockId: blocks.hometab.admin.bonusly.apiUrl }).element(
        Elements.TextInput({
          actionId: blocks.hometab.admin.bonusly.apiUrl,
          placeholder: 'https://bonus.ly/api/v1',
          minLength: 8,
          initialValue: bonuslyConfig?.url?.toString() || '',
        }),
      ).optional(),
      Blocks.Input({ label: `${Md.emoji('key')} Bonusly API Key`, blockId: blocks.hometab.admin.bonusly.apiKey }).element(
        Elements.TextInput({
          actionId: blocks.hometab.admin.bonusly.apiKey,
          minLength: 5,
          initialValue: bonuslyConfig?.apiKey || '',
        }),
      ),
      Blocks.Input({ label: `${Md.emoji('gift')} Default reason`, blockId: blocks.hometab.admin.bonusly.defaultReason }).element(
        Elements.TextInput({
          actionId: blocks.hometab.admin.bonusly.defaultReason,
          minLength: 5,
          initialValue: bonuslyConfig?.defaultReason || '',
          placeholder: 'point sent through Qrafty'
        }),
      ),
      Blocks.Input({ label: `${Md.emoji('hash')} Default hashtag`, blockId: blocks.hometab.admin.bonusly.defaultHashtag }).element(
        Elements.TextInput({
          actionId: blocks.hometab.admin.bonusly.defaultHashtag,
          minLength: 3,
          initialValue: bonuslyConfig?.defaultHashtag || '',
          placeholder: '#excellence'
        }),
      ));
  }
  return blockBuilder;
}

function buildAdminModal(qraftyConfig: IQraftyConfig, enabledOverride: boolean = false): ModalBuilder {
  return Modal({
    title: `${Md.emoji('gear')} Qrafty Settings`,
    submit: 'Update Settings',
    callbackId: actions.hometab.admin_settings_submit,
  }).blocks(
    Blocks.Header({ text: 'Basic Settings' }),
    Blocks.Input({ label: 'Qrafty Admins', blockId: blocks.hometab.admin.basic.admins }).element(
      Elements.UserMultiSelect({
        actionId: blocks.hometab.admin.basic.admins,
        placeholder: 'Additional bot admins',
      }).initialUsers(qraftyConfig.qraftyAdmins || []),
    ).optional(),
    Blocks.Input({ label: 'Company Name', blockId: blocks.hometab.admin.basic.companyName }).element(
      Elements.TextInput({
        actionId: blocks.hometab.admin.basic.companyName,
        placeholder: 'Company Name',
        minLength: 2,
        initialValue: qraftyConfig.companyName || '',
      }),
    ).optional(),
    Blocks.Input({ label: 'Notifications Channel', blockId: blocks.hometab.admin.basic.notificationChannel }).element(
      Elements.TextInput({
        actionId: blocks.hometab.admin.basic.notificationChannel,
        placeholder: 'qrafty-plusplus',
        minLength: 2,
        initialValue: qraftyConfig.notificationRoom || '',
      }),
    ).optional(),
    Blocks.Input({ label: 'False Positive Notifications Channel', blockId: blocks.hometab.admin.basic.falsePositiveNotificationChannel }).element(
      Elements.TextInput({
        actionId: blocks.hometab.admin.basic.falsePositiveNotificationChannel,
        placeholder: 'qrafty-plusplus-fail',
        minLength: 2,
        initialValue: qraftyConfig.falsePositiveRoom || '',
      }),
    ).optional(),
    Blocks.Input({ label: 'Scoreboard Notification Channel', blockId: blocks.hometab.admin.basic.scoreboardChannel }).element(
      Elements.TextInput({
        actionId: blocks.hometab.admin.basic.scoreboardChannel,
        placeholder: 'qrafty-monthly-scoreboard',
        minLength: 2,
        initialValue: qraftyConfig.scoreboardRoom || '',
      }),
    ).optional(),
    Blocks.Input({
      label: 'Is there a \"Formal\" feedback that you would like frequent senders to be prompted for?',
      blockId: blocks.hometab.admin.basic.formalPraiseUrl
    }).element(
      Elements.TextInput({
        actionId: blocks.hometab.admin.basic.formalPraiseUrl,
        placeholder: 'https://formal.praise.company.com',
        minLength: 2,
        initialValue: qraftyConfig.formalFeedbackUrl || '',
      }),
    ).optional(),
    Blocks.Input({
      label: 'When a user interacts (++ or --) with another user at what increment should they be prompted to send formal praise?',
      blockId: blocks.hometab.admin.basic.formalPraiseMod
    }).element(
      Elements.TextInput({
        actionId: blocks.hometab.admin.basic.formalPraiseMod,
        placeholder: '10',
        minLength: 2,
        initialValue: qraftyConfig.formalFeedbackModulo.toString() || '10',
      }),
    ).optional(),
    Blocks.Divider(),
    Blocks.Header({ text: `${Md.emoji('rocket')} Bonusly Integration` }),
    Blocks.Input({ label: 'Bonusly Enabled', blockId: blocks.hometab.admin.bonusly.enabled }).dispatchAction(true)
      .element(
        Elements.StaticSelect({ actionId: blocks.hometab.admin.bonusly.enabled })
          .initialOption(
            Bits.Option({
              text: qraftyConfig.bonuslyConfig?.enabled ? EnabledSettings.ENABLED : EnabledSettings.DISABLED,
              value: qraftyConfig.bonuslyConfig?.enabled ? EnabledSettings.ENABLED : EnabledSettings.DISABLED,
            }),
          )
          .options(
            Bits.Option({ text: EnabledSettings.ENABLED, value: EnabledSettings.ENABLED }),
            Bits.Option({ text: EnabledSettings.DISABLED, value: EnabledSettings.DISABLED }),
          ),
      ),
    ...buildBonuslyAdminBlocks(qraftyConfig.bonuslyConfig, enabledOverride),
    Blocks.Divider(),
    Blocks.Header({ text: 'Qrypto' }),
    Blocks.Input({ label: 'Qrypto (Crypto) Enabled', blockId: blocks.hometab.admin.qrypto.enabled }).element(
      Elements.StaticSelect({ actionId: blocks.hometab.admin.qrypto.enabled })
        .initialOption(
          Bits.Option({
            text: qraftyConfig.qryptoEnabled ? EnabledSettings.ENABLED : EnabledSettings.DISABLED,
            value: qraftyConfig.qryptoEnabled ? EnabledSettings.ENABLED : EnabledSettings.DISABLED,
          }),
        )
        .options(
          Bits.Option({ text: EnabledSettings.ENABLED, value: EnabledSettings.ENABLED }),
          Bits.Option({ text: EnabledSettings.DISABLED, value: EnabledSettings.DISABLED }),
        ),
    ),
  );
}

function buildQryptoUserBlocks(qraftyConfig: IQraftyConfig, user: IUser) {
  let qryptoBlocks: Appendable<ViewBlockBuilder> = [];
  if (qraftyConfig.qryptoEnabled) {
    qryptoBlocks.push(
      Blocks.Header({ text: 'Qrafty Token (Crypto)' }),
      Blocks.Divider(),
      Blocks.Input({
        label: `When you level up your account we will need your wallet public address \
for you to be able to withdraw your crypto. What is your public BEP20 wallet address?`,
        blockId: blocks.hometab.user.qrypto.walletAddress
      }).element(
        Elements.TextInput({
          actionId: blocks.hometab.user.qrypto.walletAddress,
          initialValue: user.walletAddress || '',
        }),
      )
    );
  }
  return qryptoBlocks
}

function buildBonuslyUserBlocks(bonuslyConfig: IBonuslyConfig, user: IUser) {
  let bonuslyBlocks: Appendable<ViewBlockBuilder> = [];
  if (bonuslyConfig.enabled) {
    bonuslyBlocks.push(
      Blocks.Header({ text: 'Bonusly Integration Settings' }),
      Blocks.Divider(),
      Blocks.Section({ text: 'Bonusly Config' }),
      Blocks.Input({
        label: `When sending a ${Md.codeInline('++')} we can also send a bonusly bonus. We can always send one, prompt you every time, or never send a bonus.`,
        blockId: blocks.hometab.user.bonusly.prompt
      }).element(
        Elements.StaticSelect({ actionId: blocks.hometab.user.bonusly.prompt })
          .initialOption(
            user.bonuslyPrompt
              ? Bits.Option({
                text: user.bonuslyPrompt,
                value: user.bonuslyPrompt,
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
        label: `When we send a ${Md.codeInline('++')} and a bonusly is included what is the default amount that you would like to send?`,
        blockId: blocks.hometab.user.bonusly.scoreOverride
      }).element(
        Elements.TextInput({
          actionId: blocks.hometab.user.bonusly.scoreOverride,
          initialValue: user.bonuslyScoreOverride?.toString() || '1',
        }),
      ),
      Blocks.Input({
        label: `When you send a Bonusly would you like Qrafty to DM you to tell you about your remaining balance?`,
        blockId: blocks.hometab.user.bonusly.pointsDm
      }).element(
        Elements.StaticSelect({ actionId: blocks.hometab.user.bonusly.pointsDm })
          .initialOption(
            Bits.Option({
              text: user.bonuslyPointsDM ? EnabledSettings.ENABLED : EnabledSettings.DISABLED,
              value: user.bonuslyPointsDM ? EnabledSettings.ENABLED : EnabledSettings.DISABLED,
            })
          )
          .options(
            Bits.Option({ text: EnabledSettings.ENABLED, value: EnabledSettings.ENABLED }),
            Bits.Option({ text: EnabledSettings.DISABLED, value: EnabledSettings.DISABLED })
          ),
      ),
    );
  }
  return bonuslyBlocks;
}