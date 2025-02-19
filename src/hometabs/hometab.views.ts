import { actions, blocks } from '@/lib/types';
import { userService } from '@/lib/services';
import { type AllMiddlewareArgs, App, type SlackViewMiddlewareArgs, type ViewSubmitAction } from '@slack/bolt';

export function register(app: App): void {
	app.view(actions.hometab.user_settings_submit, userSettingSubmit);
}

async function userSettingSubmit({
	ack,
	context,
	body,
	logger,
	view,
}: SlackViewMiddlewareArgs<ViewSubmitAction> & AllMiddlewareArgs) {
	logger.debug('hometab.views: userSettingSubmit');
	const teamId = context.teamId as string;
	const userId = body.user.id;

	const user = await userService.getOrCreateBySlackId(teamId, userId);

	const errors: Record<string, string> = {};
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
	await userService.update(teamId, user);
}
