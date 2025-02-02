import { AllMiddlewareArgs, SlackViewMiddlewareArgs, ViewSubmitAction } from '@slack/bolt';
import { ESMap } from 'typescript';

import { app } from '../app';
import { PointdPalConfig } from './entities/pointdPalConfig';
import { User } from './entities/user';
import { connectionFactory } from './lib/services/connectionsFactory';
import { actions } from './lib/types/Actions';
import { blocks } from './lib/types/BlockIds';
import { EnabledSettings } from './lib/types/Enums';

app.view(
	actions.hometab.admin_settings_submit,
	async ({ ack, context, body, logger, view }: SlackViewMiddlewareArgs<ViewSubmitAction> & AllMiddlewareArgs) => {
		const teamId = context.teamId as string;
		const userId = body.user.id;

		const connection = connectionFactory(teamId);
		const pointdPal = await PointdPalConfig(connection).findOneOrCreate(teamId as string);

		const errors: { [blockId: string]: string } = {};
		for (const option in view.state.values) {
			for (const key in view.state.values[option]) {
				const state = view.state.values[option][key];
				const textInputValue = state.value as string;
				switch (key) {
					case blocks.hometab.admin.basic.admins: {
						const selectedUsers = state.selected_users as string[];
						pointdPal.pointdPalAdmins = selectedUsers;
						for (const newAdminId of selectedUsers) {
							console.log(newAdminId);
							const user = await User(connection).findOneBySlackIdOrCreate(teamId, newAdminId);
							user.isAdmin = true;
							await user.save();
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
						pointdPal.notificationRoom = textInputValue;
						break;
					}
					case blocks.hometab.admin.basic.falsePositiveNotificationChannel: {
						if (textInputValue) {
							const lowerCaseRoomName = textInputValue.toLowerCase();
							if (lowerCaseRoomName.indexOf('#') === 0) {
								lowerCaseRoomName.substring(1, lowerCaseRoomName.length);
							}
						}
						pointdPal.falsePositiveRoom = textInputValue;
						break;
					}
					case blocks.hometab.admin.basic.scoreboardChannel: {
						if (textInputValue) {
							const lowerCaseRoomName = textInputValue.toLowerCase();
							if (lowerCaseRoomName.indexOf('#') === 0) {
								lowerCaseRoomName.substring(1, lowerCaseRoomName.length);
							}
						}
						pointdPal.scoreboardRoom = textInputValue;
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
		await pointdPal.save();
	},
);

app.view(
	actions.hometab.user_settings_submit,
	async ({ ack, context, body, logger, view }: SlackViewMiddlewareArgs<ViewSubmitAction> & AllMiddlewareArgs) => {
		const teamId = context.teamId as string;
		const userId = body.user.id;

		const connection = connectionFactory(teamId);
		const user = await User(connection).findOneBySlackIdOrCreate(teamId, userId);

		const errors: { [blockId: string]: string } = {};
		for (const option in view.state.values) {
			for (const key in view.state.values[option]) {
				const value: string = (view.state.values[option][key].value ||
					view.state.values[option][key].selected_option?.value) as string;
				switch (key) {
					case blocks.hometab.user.crypto.walletAddress: {
						if (value && !/^0x[a-fA-F0-9]{40}$/.test(value)) {
							errors[blocks.hometab.user.crypto.walletAddress] = 'Your wallet address is invalid.';
						}
						user.walletAddress = value;
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
		user.updatedAt = new Date();
		user.updatedBy = user.slackId;
		logger.debug(`Updating user configs for ${teamId} by ${userId}`);
		await user.save();
	},
);
