import { Md } from 'slack-block-builder';

import type { IUser } from '@/models/user';
import { userService } from '@/lib/services/userService';
import { withNamespace } from '@/logger';
import {
	App,
	directMention,
	type AllMiddlewareArgs,
	type SlackEventMiddlewareArgs,
	type StringIndexed,
} from '@slack/bolt';
import { type ConversationsListResponse } from '@slack/web-api';
import type { User } from '@slack/web-api/dist/types/response/UsersInfoResponse';

const logger = withNamespace('migrations');

export function register(app: App): void {
	app.message('try to map all slack users to db users', directMention, mapUsersToDb);
	app.message('try to map more data to all slack users to db users', directMention, mapMoreUserFieldsBySlackId);
	app.message('try to map @.* to db users', directMention, mapSingleUserToDb);
	// app.message('unmap all users', directMention, unmapUsersToDb);
	app.message('map all slackIds to slackEmail', directMention, mapSlackIdToEmail);
	// app.message('hubot to bolt', directMention, migrateFromHubotToBolt);
	app.message('join all old pointdPal channels', directMention, joinAllPointdPalChannels);
}

async function mapUsersToDb({
	message,
	context,
	client,
	say,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<'message'> & StringIndexed) {
	const teamId = context.teamId as string;

	// @ts-expect-error just stawp
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const userId: string = message.user;

	const { isAdmin } = await userService.getOrCreateBySlackId(teamId, userId);
	if (!isAdmin) {
		logger.error("sorry, can't do that", message, context);
		await say(`Sorry, can't do that https://i.imgur.com/Gp6wNZr.gif ${Md.user(userId)}`);
		return;
	}

	const members = (await client.users.list({})).members ?? [];

	const mappings: string[] = [];
	for (const member of members ?? []) {
		try {
			logger.debug('Map this member', JSON.stringify(member));
			const localMember = await userService.getOrCreateBySlackId(teamId, member.id as string);
			mappings.push(`\`{ name: ${localMember.name}, slackId: ${localMember.slackId}, id: ${localMember.id} }\``);
			logger.debug(`Save the new member ${JSON.stringify(localMember)}`);
		} catch (er) {
			logger.error('failed to find', member, er);
		}
	}
	await say(`Ding fries are done. We mapped ${mappings.length} of ${members.length} users. \n${mappings.join('\n')}`);
}

async function mapMoreUserFieldsBySlackId({
	message,
	context,
	client,
	logger,
	say,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<'message'> & StringIndexed) {
	const teamId = context.teamId as string;

	// @ts-expect-error just stawp
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const userId: string = message.user;

	const { isAdmin } = await userService.getOrCreateBySlackId(teamId, userId);
	if (!isAdmin) {
		logger.error("sorry, can't do that", message, context);
		await say(`Sorry, can't do that https://i.imgur.com/Gp6wNZr.gif ${Md.user(userId)}`);
		return;
	}

	const members = (await client.users.list({})).members;
	for (const member of members ?? []) {
		if (member?.profile?.email) {
			try {
				logger.debug('Map this member', JSON.stringify(member));
				const localMember = await userService.getOrCreateBySlackId(teamId, member.id as string);
				localMember.slackId = member.id as string;
				localMember.email = member.profile.email;
				await userService.update(teamId, localMember);
				logger.debug(`Save the new member ${JSON.stringify(localMember)}`);
			} catch (er) {
				logger.error('failed to find', member, er);
			}
		}
	}
	await say('Ding fries are done.');
}

async function mapSingleUserToDb({
	message,
	context,
	client,
	logger,
	say,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<'message'> & StringIndexed) {
	const teamId = context.teamId as string;
	// @ts-expect-error just stawp
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const userId: string = message.user;

	const { isAdmin } = await userService.getOrCreateBySlackId(teamId, userId);
	if (!isAdmin) {
		logger.error("sorry, can't do that", message, context);
		await say(`Sorry, can't do that https://i.imgur.com/Gp6wNZr.gif ${Md.user(userId)}`);
		return;
	}

	logger.debug(context);

	// do the mention dance
	const to = { slackId: 'drp', name: 'derrp' };

	const { user } = await client.users.info({ user: to.slackId });
	try {
		logger.debug('Map this member', JSON.stringify(user));
		const localMember = await userService.getOrCreateBySlackId(teamId, to.slackId);
		localMember.slackId = to.slackId;

		if (localMember.id) {
			await userService.update(teamId, localMember);
			await say(
				`Mapping completed for ${to.name}: { name: ${localMember.name}, slackId: ${localMember.slackId}, id: ${localMember.id} }`,
			);
			return;
		}
		logger.debug(`Save the new member ${JSON.stringify(localMember)}`);
	} catch (er) {
		logger.error('failed to find', user, er);
	}
}

// async function unmapUsersToDb({ message, context, logger, say }) {
// 	const teamId = context.teamId as string;
// 	const userId: string = message.user;

// 	const { isAdmin } = await userService.findOneBySlackIdOrCreate(teamId, userId);
// 	if (!isAdmin) {
// 		logger.error("sorry, can't do that", message, context);
// 		await say(`Sorry, can\'t do that https://i.imgur.com/Gp6wNZr.gif ${Md.user(message.user)}`);
// 		return;
// 	}

// 	try {
// 		await userService
// 			.updateMany({}, { $unset: { slackId: 1 } })
// 			.exec();
// 	} catch (er) {
// 		logger.error('failed to unset all slack ids', er);
// 	}
// 	await say('Ding fries are done. We unmapped all users');
// }

async function mapSlackIdToEmail({
	message,
	context,
	logger,
	say,
	client,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<'message'> & StringIndexed) {
	const teamId = context.teamId as string;
	// @ts-expect-error just stawp
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const userId: string = message.user;

	const { isAdmin } = await userService.getOrCreateBySlackId(teamId, userId);
	if (!isAdmin) {
		logger.error("sorry, can't do that", message, context);
		await say(`Sorry, can't do that https://i.imgur.com/Gp6wNZr.gif ${Md.user(userId)}`);
		return;
	}

	try {
		const missingEmailUsers: IUser[] = await userService.getByPredicate(teamId, 'id IS NOT NULL and email IS NULL');

		for (const user of missingEmailUsers) {
			logger.debug('Map this member', user.slackId, user.name);
			let slackUser: User | undefined;
			try {
				slackUser = (await client.users.info({ user: user.slackId })).user;
			} catch (e: unknown) {
				logger.error(`error retrieving user: ${user.slackId} ${user.name}`, (e as Error).message);
			}
			if (slackUser?.profile?.email) {
				user.email = slackUser.profile.email;
				await userService.update(teamId, user);
			}
			await say(
				`Mapping completed for ${user.name}: { name: ${user.name}, slackId: ${Md.user(user.slackId)}, email: ${
					user.email
				} }`,
			);
		}
	} catch (er) {
		logger.error('Error processing users', er);
	}
}

// async function migrateFromHubotToBolt({ message, context, logger, say, client }) {
// 	const teamId = context.teamId as string;
// 	const userId: string = message.user;
// 	const { isAdmin } = await userService.findOneBySlackIdOrCreate(teamId, userId);
// 	if (!isAdmin) {
// 		logger.error("sorry, can't do that", message, context);
// 		await say(`Sorry, can\'t do that https://i.imgur.com/Gp6wNZr.gif ${Md.user(message.user)}`);
// 		return;
// 	}

// 	try {
// 		const hubotishUsers: any[] = await userService.getAllByPredicate(teamId, 'id IS NOT NULL');

// 		for (const hubotishUser of hubotishUsers) {
// 			logger.debug('Map this member', hubotishUser.slackId, hubotishUser.name);
// 			hubotishUser.token = hubotishUser.token || hubotishUser.token;
// 			delete hubotishUser.token;
// 			hubotishUser.email = hubotishUser.slackEmail || hubotishUser.email;
// 			delete hubotishUser.slackEmail;
// 			for (const [key, value] of hubotishUser.pointsGiven) {
// 				if (isBase64(key)) {
// 					const decodedPointGiven = decode(key);
// 					hubotishUser.reasons.set(decodedPointGiven, value);
// 					logger.info(
// 						'check each point given',
// 						key,
// 						decodedPointGiven,
// 						hubotishUser.pointsGiven[key],
// 						hubotishUser.pointsGiven[decodedPointGiven],
// 					);
// 					delete hubotishUser.pointsGiven[key];
// 				} else {
// 					logger.info('point given not base 64', key);
// 				}
// 			}
// 			await say(`Decoding the reasons and the points given finished for ${Md.user(hubotishUser.slackId)}`);
// 			await userService.replaceOne({ slackId: hubotishUser.slackId }, hubotishUser as IUser);
// 		}
// 	} catch (er) {
// 		logger.error('Error processing users', er);
// 	}
// }

async function joinAllPointdPalChannels({
	say,
	logger,
	message,
	client,
	context,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<'message'> & StringIndexed) {
	let result: ConversationsListResponse | undefined = undefined;
	const teamId = context.teamId as string;
	const oldPointdPal = 'U03HDRG36';

	// @ts-expect-error just stawp
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const userId: string = message.user;
	const { isAdmin } = await userService.getOrCreateBySlackId(teamId, userId);
	if (!isAdmin) {
		logger.error("sorry, can't do that", message, context);
		await say(`Sorry, can't do that https://i.imgur.com/Gp6wNZr.gif ${Md.user(userId)}`);
		return;
	}

	try {
		result = await client.conversations.list({ team_id: teamId });
	} catch (e: unknown) {
		// logger.error(e)
		logger.error('Error getting list of conversations', (e as Error).message);
	}
	if (!result || !result.channels) {
		logger.info('could not find conversation list in migration');
		return;
	}

	for (const channel of result.channels) {
		try {
			const { members } = await client.conversations.members({ channel: channel.id as string });
			if (members && members.includes(oldPointdPal)) {
				await client.conversations.join({ channel: channel.id as string });
			}
		} catch (e: unknown) {
			logger.error(`There was an error looking up members and joining the channel ${channel.id}`, (e as Error).message);
		}
	}
}
