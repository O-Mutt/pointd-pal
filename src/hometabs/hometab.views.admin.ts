import { actions, blocks } from '@/lib/types';
import { configService } from '@/lib/services';
import { userService } from '@/lib/services';
import { type AllMiddlewareArgs, App, type SlackViewMiddlewareArgs, type ViewSubmitAction } from '@slack/bolt';

export function register(app: App): void {
	app.view(actions.hometab.admin_settings_submit, adminSettingSubmit);
}

async function adminSettingSubmit({
	ack,
	context,
	body,
	logger,
	view,
}: SlackViewMiddlewareArgs<ViewSubmitAction> & AllMiddlewareArgs) {
	logger.debug('hometab.views: adminSettingSubmit');
	const teamId = context.teamId as string;
	const userId = body.user.id;

	const pointdPal = await configService.getOrCreate(teamId);

	const errors: Record<string, string> = {};
	for (const option in view.state.values) {
		for (const key in view.state.values[option]) {
			const state = view.state.values[option][key];
			const textInputValue = state.value as string;
			switch (key) {
				case blocks.hometab.admin.basic.admins: {
					const selectedUsers = state.selected_users as string[];
					// pointdPal.pointdPalAdmins = selectedUsers;
					for (const newAdminId of selectedUsers) {
						logger.info(newAdminId);
						const user = await userService.getOrCreateBySlackId(teamId, newAdminId);
						user.isAdmin = true;
						await userService.update(teamId, user);
					}
					break;
				}
				case blocks.hometab.admin.basic.companyName: {
					pointdPal.companyName = textInputValue;
					break;
				}
				case blocks.hometab.admin.basic.notificationChannel: {
					if (textInputValue) {
						const lowerCaseRoomName = textInputValue.toLowerCase();
						if (lowerCaseRoomName.indexOf('#') === 0) {
							lowerCaseRoomName.substring(1, lowerCaseRoomName.length);
						}
					}
					pointdPal.notificationChannel = textInputValue;
					break;
				}
				case blocks.hometab.admin.basic.falsePositiveNotificationChannel: {
					if (textInputValue) {
						const lowerCaseRoomName = textInputValue.toLowerCase();
						if (lowerCaseRoomName.indexOf('#') === 0) {
							lowerCaseRoomName.substring(1, lowerCaseRoomName.length);
						}
					}
					pointdPal.falsePositiveChannel = textInputValue;
					break;
				}
				case blocks.hometab.admin.basic.scoreboardChannel: {
					if (textInputValue) {
						const lowerCaseRoomName = textInputValue.toLowerCase();
						if (lowerCaseRoomName.indexOf('#') === 0) {
							lowerCaseRoomName.substring(1, lowerCaseRoomName.length);
						}
					}
					pointdPal.scoreboardChannel = textInputValue;
					break;
				}
				case blocks.hometab.admin.basic.formalPraiseUrl: {
					pointdPal.formalFeedbackUrl = textInputValue;
					break;
				}
				case blocks.hometab.admin.basic.formalPraiseMod: {
					const modulo = parseInt(textInputValue, 10);
					if (isNaN(modulo)) {
						errors[blocks.hometab.admin.basic.formalPraiseMod] = 'Formal praise increment must be a number';
					} else {
						pointdPal.formalFeedbackModulo = modulo;
					}
					break;
				}
				default: {
					logger.debug(`key not recognized: ${key}`);
					break;
				}
			}
		}
	}

	if (Object.keys(errors).length > 0) {
		await ack({
			response_action: 'errors',
			errors: errors,
		});
		return;
	} else {
		await ack();
	}

	pointdPal.updatedBy = userId;
	pointdPal.updatedAt = new Date();
	logger.debug(`Updating admin configs for ${teamId} by ${userId}`);
	await configService.update(teamId, pointdPal);
}
