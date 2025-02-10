import { Bits, Blocks, Elements, Md, Modal } from 'slack-block-builder';
import { SlackModalDto } from 'slack-block-builder/dist/internal/dto';

import { MessageBuilder as Builder } from '@/lib/messageBuilder';
import { eventBus } from '@/lib/services/eventBus';
import { scorekeeperService } from '@/lib/services/scorekeeperService';
import { actions, blocks, DirectionEnum, type PPEvent, PPEventName } from '@/lib/types';
import { withNamespace } from '@/logger';
import { type IUser } from '@/models/user';
import {
	type AllMiddlewareArgs,
	App,
	type MessageShortcut,
	type SlackCommandMiddlewareArgs,
	type SlackShortcutMiddlewareArgs,
	type SlackViewMiddlewareArgs,
	type ViewSubmitAction,
} from '@slack/bolt';
import {
	type ChatGetPermalinkResponse,
	type ChatPostEphemeralArguments,
	type ChatPostMessageArguments,
} from '@slack/web-api';

import { multiUserSeparator, multiUserVoteRegexp, upANDDownVoteRegexp, userObject } from './lib/messageMatchers';

const logger = withNamespace('shortcuts');

export function register(app: App): void {
	app.command('/plusplus', handleSlashCommand);
	app.shortcut(actions.shortcuts.message, handleShortcut);
	app.view(actions.shortcuts.message, viewMessage);
}

async function handleSlashCommand({ ack, body, command, client }: SlackCommandMiddlewareArgs & AllMiddlewareArgs) {
	try {
		await ack();
		const singleUser = upANDDownVoteRegexp;
		const multiUser = multiUserVoteRegexp;
		let userIds: string[] = [];
		let operator: string | undefined;
		let reason: string | undefined;
		if (body.text) {
			const isSingleUser = singleUser.test(body.text);
			const isMultiUser = multiUser.test(body.text);
			if (isSingleUser) {
				const matches = body.text.match(singleUser)?.groups;
				logger.log(matches);
				if (matches) {
					userIds = [matches['userId']];
					operator = matches['operator'];
					reason = matches['reason'];
				}
			} else if (isMultiUser) {
				const matches = body.text.match(multiUser)?.groups;
				if (matches) {
					userIds = matches['allUsers'].trim().split(new RegExp(multiUserSeparator)).filter(Boolean);
					userIds = userIds
						// Remove empty ones: {,,,}++
						.filter((id) => !!id.length)
						// remove <@.....>
						.map((id) => id.replace(new RegExp(userObject), '$1'))
						// Remove duplicates: {user1,user1}++
						.filter((id, pos, self) => self.indexOf(id) === pos);
					operator = matches['operator'];
					reason = matches['reason'];
				}
			}
		}
		logger.log(command, body);
		const channel = body.channel_id;

		const json: PrivateViewMetaDataJson = {
			channel,
		};

		const localOptions = {
			userIds,
			operator,
			reason,
		};

		const modalView = buildMessagePlusPlusModal(json, localOptions);
		await client.views.open({
			trigger_id: command.trigger_id,
			view: modalView,
		});
	} catch (e: unknown) {
		logger.log('slash err', e);
	}
}

async function handleShortcut({
	shortcut,
	ack,
	body,
	client,
}: SlackShortcutMiddlewareArgs<MessageShortcut> & AllMiddlewareArgs) {
	try {
		await ack();
		logger.log(body);
		const channel = body.channel.id;
		const messageTs = body.message.ts;
		const userId = body.message.user;
		const { permalink }: ChatGetPermalinkResponse = await client.chat.getPermalink({ channel, message_ts: messageTs });

		const json: { channel: string; messageTs: string; permalink: string | undefined } = {
			channel,
			messageTs,
			permalink,
		};
		const localOptions: PrivateViewLocalOptions = {
			userIds: [userId],
			permalink,
		};

		const modalView = buildMessagePlusPlusModal(json, localOptions);
		await client.views.open({
			trigger_id: shortcut.trigger_id,
			view: modalView,
		});
	} catch (e: unknown) {
		logger.log('shortcut err', e);
	}
}

function buildMessagePlusPlusModal(
	privateViewMetadataJson: PrivateViewMetaDataJson,
	localOptions: PrivateViewLocalOptions,
): SlackModalDto {
	const permalink = localOptions.permalink ? `${Md.link(localOptions.permalink, 'this message')}` : undefined;
	const initialReason = localOptions.reason || permalink;
	return Modal({
		title: `${Md.emoji('rocket')} Send a PlusPlus`,
		submit: 'Send',
		callbackId: actions.shortcuts.message,
	})
		.blocks(
			Blocks.Header({ text: 'Basic Settings' }),
			Blocks.Input({ label: 'Who are you sending ++/-- to?', blockId: blocks.shortcuts.message.recipients }).element(
				Elements.UserMultiSelect({
					actionId: blocks.shortcuts.message.recipients,
					placeholder: 'Jill Example',
				}).initialUsers(localOptions.userIds),
			),
			Blocks.Input({
				label: 'Are you giving them a point (++) or taking one away (--)?',
				blockId: blocks.shortcuts.message.operator,
			}).element(
				Elements.StaticSelect({
					actionId: blocks.shortcuts.message.operator,
					placeholder: '++',
				})
					.options(
						Bits.Option({ text: DirectionEnum.PLUS, value: DirectionEnum.PLUS }),
						Bits.Option({ text: DirectionEnum.MINUS, value: DirectionEnum.MINUS }),
					)
					.initialOption(
						localOptions.operator
							? Bits.Option({ text: localOptions.operator, value: localOptions.operator })
							: undefined,
					),
			),
			Blocks.Input({ label: 'Why are you sending these points?', blockId: blocks.shortcuts.message.reason })
				.element(
					Elements.TextInput({
						actionId: blocks.shortcuts.message.reason,
						placeholder: 'Being the best co-worker in the world',
					}).initialValue(initialReason),
				)
				.optional(),
		)
		.privateMetaData(JSON.stringify(privateViewMetadataJson))
		.buildToObject();
}

async function viewMessage({
	ack,
	context,
	body,
	logger,
	view,
	client,
}: SlackViewMiddlewareArgs<ViewSubmitAction> & AllMiddlewareArgs) {
	await ack();
	const teamId = context.teamId as string;
	const from = body.user.id;
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const { channel, messageTs, _permalink }: { channel: string; messageTs: string; _permalink: string } = JSON.parse(
		view.private_metadata,
	);

	let idArray: string[] = [];
	let operator: DirectionEnum = DirectionEnum.PLUS;
	let reason: string | undefined;
	// const errors: Record<string, string> = {};
	for (const option in view.state.values) {
		for (const key in view.state.values[option]) {
			const state = view.state.values[option][key];
			logger.info('each key state:', state);
			switch (key) {
				case blocks.shortcuts.message.recipients: {
					idArray = state.selected_users as string[];
					break;
				}
				case blocks.shortcuts.message.operator: {
					operator = state.selected_option?.value as DirectionEnum;
					break;
				}
				case blocks.shortcuts.message.reason: {
					reason = state.value ?? undefined;
					break;
				}
			}
		}
	}

	idArray = idArray.filter((id) => id !== from);
	const increment: number = operator === DirectionEnum.PLUS ? 1 : -1;

	logger.debug('We filtered out empty items and removed "self"', idArray.join(','));
	let messages: string[] = [];
	const notificationMessage: string[] = [];
	let sender: IUser | undefined = undefined;
	const recipients: IUser[] = [];
	for (const toUserId of idArray) {
		let response: { toUser: IUser; fromUser: IUser };
		try {
			response = await scorekeeperService.incrementScore(teamId, toUserId, from, channel, increment, reason);
		} catch (e: unknown) {
			const ephemeral: ChatPostEphemeralArguments = {
				text: (e as Error).message,
				channel,
				user: from,
			};
			await client.chat.postEphemeral(ephemeral);

			continue;
		}
		sender = response.fromUser;
		if (response.toUser) {
			logger.debug(
				`clean names map[${toUserId}]: ${response.toUser.score}, the reason ${
					reason ? response.toUser.reasons[reason] : 'n/a'
				} `,
			);
			messages.push(Builder.getMessageForNewScore(response.toUser, reason));
			recipients.push(response.toUser);
			notificationMessage.push(
				`${Md.user(response.fromUser.slackId)} ${increment === 1 ? 'sent' : 'removed'} a PointdPal point ${
					increment === 1 ? 'to' : 'from'
				} ${Md.user(response.toUser.slackId)} in ${Md.channel(channel)} `,
			);
		}
	}
	messages = messages.filter((message) => !!message); // de-dupe
	if (messages) {
		logger.debug(`These are the messages \n ${messages.join(' ')} `);
		const postArgs: ChatPostMessageArguments = {
			text: messages.join('\n'),
			channel: channel,
		};
		if (messageTs) {
			postArgs.thread_ts = messageTs;
		}
		const postResp = await client.chat.postMessage(postArgs);
		logger.info('the message post response', postResp);
		const plusPlusEvent: PPEvent = {
			notificationMessage: notificationMessage.join('\n'),
			sender: sender as IUser,
			recipients,
			direction: operator,
			amount: 1,
			channel,
			reason,
			teamId,
			originalMessageTs: postResp.message?.thread_ts as string,
			originalMessageParentTs: postResp.ts as string,
		};

		eventBus.emit(PPEventName, plusPlusEvent);
	}
}

interface PrivateViewMetaDataJson {
	channel: string;
	messageTs?: string;
	permalink?: string;
}

interface PrivateViewLocalOptions {
	userIds: (string | undefined)[];
	operator?: string;
	reason?: string;
	permalink?: string;
}
