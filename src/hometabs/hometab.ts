import { Blocks, Elements, HomeTab, Md, type ViewBlockBuilder } from 'slack-block-builder';

import { type AllMiddlewareArgs, App, type SlackEventMiddlewareArgs } from '@slack/bolt';
import { type View } from '@slack/types';

import type { IUser, IPointdPalConfig } from '@/models';
import { actions } from '@/lib/types';
import { type Appendable } from 'slack-block-builder/dist/internal';
import { configService } from '@/lib/services/configService';
import { userService } from '@/lib/services/userService';

export function register(app: App): void {
	app.event('app_home_opened', updateHomeTab);
}

async function updateHomeTab({
	event,
	context,
	client,
	logger,
}: SlackEventMiddlewareArgs<'app_home_opened'> & AllMiddlewareArgs) {
	logger.debug('hometab: app home was opened!');
	try {
		const userId = event.user;
		const teamId = context.teamId as string;

		const user = await userService.getOrCreateBySlackId(teamId, userId);
		const pointdPalConfig = await configService.getOrCreate(teamId);

		const hometab = HomeTab({ callbackId: 'hometab' }).blocks(
			Blocks.Header({ text: 'Welcome to PointdPal!' }),
			Blocks.Section({
				text: `We make engagement and praise ${Md.italic('super')} easy. A quick ${
					Md.codeInline('++') + ' or ' + Md.codeInline('--')
				} to a friend or coworker via slack shows them that you notice and appreciate them.`,
			}),
			...getAdminConfigSection(user),
			...getUserConfigSection(user, pointdPalConfig),
		);
		await client.views.publish({ token: context.botToken, view: hometab.buildToObject() as View, user_id: userId });
	} catch (e) {
		logger.error('hometab: error publishing hometab', e);
	}
}

function getAdminConfigSection(user: IUser): Appendable<ViewBlockBuilder> {
	const blocks: Appendable<ViewBlockBuilder> = [];
	if (!user.isAdmin) {
		return blocks;
	}

	blocks.push(
		Blocks.Divider(),
		Blocks.Header({ text: 'Administration' }),
		Blocks.Section({
			text: ':warning: This is where you can enable various integrations and setup how PointdPal notifies the world. Tread lightly.',
		}).accessory(Elements.Button({ text: 'Admin Settings', actionId: actions.hometab.admin_settings }).primary()),
		// Blocks.Section({
		// 	text: `${Md.emoji('recycle')} Sync Admins`,
		// }).accessory(Elements.Button({ text: 'Sync', actionId: actions.hometab.sync_admins }).primary()),
	);
	return blocks;
}

function getUserConfigSection(_user: IUser, _pointdPalConfig: IPointdPalConfig | null): Appendable<ViewBlockBuilder> {
	const blocks: Appendable<ViewBlockBuilder> = [];

	blocks.push(
		Blocks.Divider(),

		Blocks.Header({ text: 'User Configuration' }),
		Blocks.Section({
			text: `You can configure PointdPal in a few different ways, check it out.  ${Md.emoji('hammer_and_wrench')}`,
		}).accessory(Elements.Button({ text: 'User Settings', actionId: actions.hometab.user_settings }).primary()),
	);
	return blocks;
}
