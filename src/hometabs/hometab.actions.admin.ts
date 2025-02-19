import { type Member } from '@slack/web-api/dist/types/response/UsersListResponse';
import { Bits, Blocks, Elements, Modal, type ModalBuilder, type UserMultiSelectBuilder } from 'slack-block-builder';
import {
	type AllMiddlewareArgs,
	App,
	type BlockButtonAction,
	type Logger,
	type SlackActionMiddlewareArgs,
} from '@slack/bolt';
import { actions, blocks } from '@/lib/types';
import { userService, configService } from '@/lib/services';
import type { IPointdPalConfig, IUser } from '@/models';

export function register(app: App): void {
	app.action(actions.hometab.admin_settings, adminSettingsAction);
	app.action(actions.hometab.sync_admins, syncAdminsAction);
}

async function adminSettingsAction({
	ack,
	client,
	context,
	body,
	logger,
}: SlackActionMiddlewareArgs<BlockButtonAction> & AllMiddlewareArgs) {
	await ack();
	logger.debug('hometab.actions: register admin settings action');
	const teamId = context.teamId as string;
	const userId = body.user.id;
	const user = await userService.getOrCreateBySlackId(teamId, userId);
	const admins = await userService.getByPredicate(teamId, 'is_admin = true');
	const pointdPalConfig = await configService.getOrCreate(teamId);

	if (!user.isAdmin || !pointdPalConfig) {
		return; //empty section because the user isn't an admin
	}

	logger.debug('building admin modal', pointdPalConfig, admins);
	const adminSettingsModal = buildAdminModal(
		pointdPalConfig,
		admins.map((a) => a.slackId),
		logger,
	).buildToObject();

	logger.debug('triggering view open for admin settings', body.trigger_id, adminSettingsModal);
	await client.views.open({
		trigger_id: body.trigger_id,
		view: adminSettingsModal,
	});
}

async function syncAdminsAction({
	ack,
	body,
	context,
	logger,
	client,
}: SlackActionMiddlewareArgs<BlockButtonAction> & AllMiddlewareArgs) {
	try {
		await ack();
		logger.debug('hometab.actions: register admin sync admins');

		const teamId = context.teamId as string;
		const userId = body.user.id;
		const user = await userService.getOrCreateBySlackId(teamId, userId);
		const _pointdPalConfig = await configService.getOrCreate(teamId);

		if (!user.isAdmin) {
			return;
		}

		const userList = await client.users.list({ team_id: teamId });
		if (!userList.ok) {
			logger.error('error getting user list for sync admins action', userList.error);
		}
		const adminIds =
			userList.members
				?.filter((user: Member) => {
					return user.is_admin === true && user.id;
				})
				.map((admin) => admin.id!) ?? [];

		// get our db admins
		const users = await userService.getByPredicate(teamId, 'is_admin = true');
		const adminUsers = users.map((admin) => admin.slackId);

		// concat the two lists together
		adminUsers.concat(adminIds);
		const updateAll: Promise<IUser>[] = [];
		for (const admin of adminUsers) {
			updateAll.push(userService.setUserAsAdmin(teamId, admin));
		}
		await Promise.all(updateAll);
		return;
	} catch (e: unknown) {
		logger.error('sync admin action failed', e);
	}
}

function buildAdminModal(
	pointdPalConfig: IPointdPalConfig,
	admins: string[],
	logger?: Logger,
	_enabledOverride = false,
): ModalBuilder {
	logger?.info('returning admin modal');
	const adminSettingsModal = Modal({
		title: `Admin Settings`,
		submit: 'Update Settings',
		callbackId: actions.hometab.admin_settings_submit,
	});

	const adminsBlock = Blocks.Input({ label: 'PointdPal Admins', blockId: blocks.hometab.admin.basic.admins })
		.element(
			Elements.UserMultiSelect({
				actionId: blocks.hometab.admin.basic.admins,
				placeholder: 'Additional bot admins',
			}),
		)
		.optional();
	if (admins?.length === 0) {
		(adminsBlock.element[0] as UserMultiSelectBuilder).initialUsers(admins);
	}

	const companyNameBlock = Blocks.Input({ label: 'Company Name', blockId: blocks.hometab.admin.basic.companyName })
		.element(
			Elements.TextInput({
				actionId: blocks.hometab.admin.basic.companyName,
				placeholder: 'Company Name',
				minLength: 2,
				...(pointdPalConfig.companyName && { initialValue: pointdPalConfig.companyName }),
			}),
		)
		.optional();

	const notificationsChannelBlock = Blocks.Input({
		label: 'Notifications Channel',
		blockId: blocks.hometab.admin.basic.notificationChannel,
	})
		.element(
			Elements.ChannelSelect({
				actionId: blocks.hometab.admin.basic.notificationChannel,
				placeholder: 'pointd-plusplus',
				...(pointdPalConfig.notificationChannel && { initialChannel: pointdPalConfig.notificationChannel }),
			}),
		)
		.optional();

	const falsePositiveNotificationsChannelBlock = Blocks.Input({
		label: 'False Positive Notifications Channel',
		blockId: blocks.hometab.admin.basic.falsePositiveNotificationChannel,
	})
		.element(
			Elements.ChannelSelect({
				actionId: blocks.hometab.admin.basic.falsePositiveNotificationChannel,
				placeholder: 'pointd-plusplus-fail',
				...(pointdPalConfig.falsePositiveChannel && { initialChannel: pointdPalConfig.falsePositiveChannel }),
			}),
		)
		.optional();

	const scoreboardChannelBlock = Blocks.Input({
		label: 'Scoreboard Notification Channel',
		blockId: blocks.hometab.admin.basic.scoreboardChannel,
	})
		.element(
			Elements.ChannelSelect({
				actionId: blocks.hometab.admin.basic.scoreboardChannel,
				placeholder: 'pointd-monthly-scoreboard',
				...(pointdPalConfig.scoreboardChannel && { initialChannel: pointdPalConfig.scoreboardChannel }),
			}),
		)
		.optional();

	const formalFeedbackBlock = Blocks.Input({
		label: 'Is there a "Formal" feedback that you would like frequent senders to be prompted for?',
		blockId: blocks.hometab.admin.basic.formalPraiseUrl,
	})
		.element(
			Elements.TextInput({
				actionId: blocks.hometab.admin.basic.formalPraiseUrl,
				placeholder: 'https://formal.praise.company.com',
				minLength: 2,
				// append the initial value if it exists
				...(pointdPalConfig.formalFeedbackUrl && { initialValue: pointdPalConfig.formalFeedbackUrl }),
			}),
		)
		.optional();

	const moduloBlock = Blocks.Input({
		label:
			'When a user interacts (++ or --) with another user at what increment should they be prompted to send formal praise? (Calculated as a modulo)',
		blockId: blocks.hometab.admin.basic.formalPraiseMod,
	})
		.element(
			Elements.NumberInput({
				actionId: blocks.hometab.admin.basic.formalPraiseMod,
				placeholder: '10 (1-100)',
				isDecimalAllowed: false,
				minValue: 1,
				maxValue: 100,
				...(pointdPalConfig.formalFeedbackModulo && { initialValue: pointdPalConfig.formalFeedbackModulo }),
			}),
		)
		.optional();

	const aprilFoolsOptions = [Bits.Option({ text: 'Yes', value: 'true' }), Bits.Option({ text: 'No', value: 'false' })];
	const isAprilFoolsEnabled = Blocks.Input({
		label:
			'April fools day (April 1st) is a well known internet meme holiday. We also inject our own fun on April 1st but are aware that this may not fit in all work cultures. When enabled the points are still counted but the responses are modified in various way (randomly). Do you want to enable april fools day fun?',
		blockId: blocks.hometab.admin.basic.isAprilFoolsEnabled,
	}).element(
		Elements.RadioButtons({
			actionId: blocks.hometab.admin.basic.isAprilFoolsEnabled,
		})
			.options(aprilFoolsOptions)
			.initialOption(pointdPalConfig.isAprilFoolsDayEnabled ? aprilFoolsOptions[0] : aprilFoolsOptions[1]),
	);

	/* Blocks.Divider(),
    Blocks.Header({ text: 'Crypto' }), */

	adminSettingsModal.blocks(
		Blocks.Header({ text: 'Basic Settings' }),
		adminsBlock,
		companyNameBlock,
		notificationsChannelBlock,
		falsePositiveNotificationsChannelBlock,
		scoreboardChannelBlock,
		formalFeedbackBlock,
		moduloBlock,
		isAprilFoolsEnabled,
	);
	return adminSettingsModal;
}
