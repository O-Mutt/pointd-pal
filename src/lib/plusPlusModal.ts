import type { SlackModalDto } from 'slack-block-builder/dist/internal';
import type { PrivateViewMetaDataJson } from './types/PrivateViewMetaDataJson';
import type { PrivateViewLocalOptions } from './types/PrivateViewLocalOptions';
import { Bits, Blocks, Elements, Md, Modal } from 'slack-block-builder';
import { actions, blocks, DirectionEnum } from './types';

export function buildMessagePlusPlusModal(
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
