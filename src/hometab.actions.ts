import { Blocks, Elements, Md, Modal, ModalBuilder, ViewBlockBuilder } from 'slack-block-builder';
import { AllMiddlewareArgs, BlockButtonAction, SlackActionMiddlewareArgs } from '@slack/bolt';
import { View } from '@slack/types';
import { Appendable } from 'slack-block-builder/dist/internal';

import { app } from '@/app';
import { IUser } from '@//entities/user';
import { actions } from '@/lib/types/Actions';
import { IPointdPalConfig } from '@/entities/pointdPalConfig';
import { blocks } from '@/lib/types/BlockIds';
import * as userService from '@/services/userService';
import * as configService from '@/services/configService';

app.action(
	actions.hometab.admin_settings,
	async ({ ack, client, context, body }: SlackActionMiddlewareArgs<BlockButtonAction> & AllMiddlewareArgs) => {
		await ack();
		const teamId = context.teamId as string;
		const userId = body.user.id;
		const user = await userService.findOneBySlackIdOrCreate(teamId, userId);
		const admins = await userService.getAllByPredicate(teamId, 'is_admin = true');
		const pointdPalConfig = await configService.findOneOrCreate(teamId);

		if (!user.isAdmin || !pointdPalConfig) {
			return; //empty section because the user isn't an admin
		}
		const adminSettingsModal = buildAdminModal(
			pointdPalConfig,
			admins.map((a) => a.slackId),
		).buildToObject();

		await client.views.open({
			trigger_id: body.trigger_id,
			view: adminSettingsModal,
		});
	},
);

app.action(
	actions.hometab.user_settings,
	async ({ ack, client, context, body, logger }: SlackActionMiddlewareArgs<BlockButtonAction> & AllMiddlewareArgs) => {
		await ack();
		const teamId = context.teamId as string;
		const userId = body.user.id;
		const pointdPalConfig = await configService.findOneOrCreate(teamId);
		const user = await userService.findOneBySlackIdOrCreate(teamId, userId);

		if (!user || !pointdPalConfig) {
			return;
		}

		logger.info('user for user settings', user);
		const userSettingsModal = Modal({
			title: `${Md.emoji('gear')} PointdPal Settings`,
			submit: 'Update Settings',
			callbackId: actions.hometab.user_settings_submit,
		}).blocks(...buildCryptoUserBlocks(pointdPalConfig, user));

		await client.views.open({
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
		const user = await userService.findOneBySlackIdOrCreate(teamId, userId);
		const _pointdPalConfig = await configService.findOneOrCreate(teamId);

		if (!user.isAdmin) {
			return;
		}

		const { members } = await app.client.users.list({ team_id: teamId });
		const admins: string[] = members
			?.filter((user) => user.is_admin === true)
			.map((admin) => admin.id as string) as string[];
		const users = await userService.getAllByPredicate(teamId, 'is_admin = true');
		const adminUsers = users.map((admin) => admin.slackId);
		adminUsers.concat(admins);
		const updateAll: Promise<IUser>[] = [];
		for (const admin of adminUsers) {
			updateAll.push(userService.setUserAsAdmin(teamId, admin));
		}
		await Promise.all(updateAll);
		return;
	},
);

function buildAdminModal(pointdPalConfig: IPointdPalConfig, admins: string[], _enabledOverride = false): ModalBuilder {
	return Modal({
		title: `${Md.emoji('gear')} PointdPal Settings`,
		submit: 'Update Settings',
		callbackId: actions.hometab.admin_settings_submit,
	}).blocks(
		Blocks.Header({ text: 'Basic Settings' }),
		Blocks.Input({ label: 'PointdPal Admins', blockId: blocks.hometab.admin.basic.admins })
			.element(
				Elements.UserMultiSelect({
					actionId: blocks.hometab.admin.basic.admins,
					placeholder: 'Additional bot admins',
				}).initialUsers(admins || []),
			)
			.optional(),
		Blocks.Input({ label: 'Company Name', blockId: blocks.hometab.admin.basic.companyName })
			.element(
				Elements.TextInput({
					actionId: blocks.hometab.admin.basic.companyName,
					placeholder: 'Company Name',
					minLength: 2,
					initialValue: pointdPalConfig.companyName || '',
				}),
			)
			.optional(),
		Blocks.Input({ label: 'Notifications Channel', blockId: blocks.hometab.admin.basic.notificationChannel })
			.element(
				Elements.TextInput({
					actionId: blocks.hometab.admin.basic.notificationChannel,
					placeholder: 'pointdPal-plusplus',
					minLength: 2,
					initialValue: pointdPalConfig.notificationRoom || '',
				}),
			)
			.optional(),
		Blocks.Input({
			label: 'False Positive Notifications Channel',
			blockId: blocks.hometab.admin.basic.falsePositiveNotificationChannel,
		})
			.element(
				Elements.TextInput({
					actionId: blocks.hometab.admin.basic.falsePositiveNotificationChannel,
					placeholder: 'pointdPal-plusplus-fail',
					minLength: 2,
					initialValue: pointdPalConfig.falsePositiveRoom || '',
				}),
			)
			.optional(),
		Blocks.Input({ label: 'Scoreboard Notification Channel', blockId: blocks.hometab.admin.basic.scoreboardChannel })
			.element(
				Elements.TextInput({
					actionId: blocks.hometab.admin.basic.scoreboardChannel,
					placeholder: 'pointdPal-monthly-scoreboard',
					minLength: 2,
					initialValue: pointdPalConfig.scoreboardRoom || '',
				}),
			)
			.optional(),
		Blocks.Input({
			label: 'Is there a "Formal" feedback that you would like frequent senders to be prompted for?',
			blockId: blocks.hometab.admin.basic.formalPraiseUrl,
		})
			.element(
				Elements.TextInput({
					actionId: blocks.hometab.admin.basic.formalPraiseUrl,
					placeholder: 'https://formal.praise.company.com',
					minLength: 2,
					initialValue: pointdPalConfig.formalFeedbackUrl || '',
				}),
			)
			.optional(),
		Blocks.Input({
			label:
				'When a user interacts (++ or --) with another user at what increment should they be prompted to send formal praise?',
			blockId: blocks.hometab.admin.basic.formalPraiseMod,
		})
			.element(
				Elements.TextInput({
					actionId: blocks.hometab.admin.basic.formalPraiseMod,
					placeholder: '10',
					minLength: 2,
					initialValue: pointdPalConfig.formalFeedbackModulo.toString() || '10',
				}),
			)
			.optional(),
		Blocks.Divider(),
		/* Blocks.Divider(),
    Blocks.Header({ text: 'Crypto' }), */
	);
}

function buildCryptoUserBlocks(pointdPalConfig: IPointdPalConfig, user: IUser) {
	const cryptoBlocks: Appendable<ViewBlockBuilder> = [];
	cryptoBlocks.push(
		Blocks.Header({ text: 'Pointd Pal Token (Crypto)' }),
		Blocks.Divider(),
		Blocks.Input({
			label: `When you level up your account we will need your wallet public address \
for you to be able to withdraw your crypto. What is your public BEP20 wallet address?`,
			blockId: blocks.hometab.user.crypto.walletAddress,
		})
			.element(
				Elements.TextInput({
					actionId: blocks.hometab.user.crypto.walletAddress,
					initialValue: user.walletAddress || '',
				}),
			)
			.optional(),
	);
	return cryptoBlocks;
}
