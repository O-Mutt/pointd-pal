import { Blocks, Elements, Modal, type ViewBlockBuilder } from 'slack-block-builder';
import { type AllMiddlewareArgs, App, type BlockButtonAction, type SlackActionMiddlewareArgs } from '@slack/bolt';
import { type View } from '@slack/types';
import { type Appendable } from 'slack-block-builder/dist/internal';

import type { IUser } from '@/models';
import { actions } from '@/lib/types';
import { type IPointdPalConfig } from '@/models/pointdPalConfig';
import { blocks } from '@/lib/types';
import { userService } from '@/lib/services/userService';
import { configService } from '@/lib/services/configService';

export function register(app: App): void {
	app.action(actions.hometab.user_settings, userSettingsAction);
}

async function userSettingsAction({
	ack,
	client,
	context,
	body,
	logger,
}: SlackActionMiddlewareArgs<BlockButtonAction> & AllMiddlewareArgs) {
	await ack();
	logger.debug('hometab.actions: register admin settings user settings');
	const teamId = context.teamId as string;
	const userId = body.user.id;
	const pointdPalConfig = await configService.getOrCreate(teamId);
	const user = await userService.getOrCreateBySlackId(teamId, userId);

	if (!user || !pointdPalConfig) {
		return;
	}

	logger.info('user for user settings', user);
	const userSettingsModal = Modal({
		title: `User Settings`,
		submit: 'Update Settings',
		callbackId: actions.hometab.user_settings_submit,
	}).blocks(...buildCryptoUserBlocks(pointdPalConfig, user));

	await client.views.open({
		trigger_id: body.trigger_id,
		view: userSettingsModal.buildToObject() as View,
	});
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
