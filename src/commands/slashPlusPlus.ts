import { multiUserSeparator, multiUserVoteRegexp, upANDDownVoteRegexp, userObject } from '@/lib/messageMatchers';
import { buildMessagePlusPlusModal } from '@/lib/plusPlusModal';
import type { PrivateViewMetaDataJson } from '@/lib/types/PrivateViewMetaDataJson';
import type { AllMiddlewareArgs, App, SlackCommandMiddlewareArgs } from '@slack/bolt';

export function register(app: App): void {
	app.command('/plusplus', handleSlashCommand);
}

async function handleSlashCommand({
	ack,
	body,
	command,
	client,
	logger,
}: SlackCommandMiddlewareArgs & AllMiddlewareArgs) {
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
				logger.info(matches);
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
		logger.info(command, body);
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
		logger.error('slash err', e);
	}
}
