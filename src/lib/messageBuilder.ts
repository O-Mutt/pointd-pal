import { Md } from 'slack-block-builder';
import { IUser } from '@/entities/user';

export class MessageBuilder {
	static getMessageForNewScore(user: IUser, reason: string | undefined): string {
		if (!user) {
			return '';
		}

		let message = `${Md.user(user.slackId)} has ${user.score} point${H.getEsOnEndOfWord(user.score)}`;

		message = MessageBuilder.getScoreFlare(user.score, message);

		message += MessageBuilder.getCryptoScore(user);

		message += MessageBuilder.getReasonModifier(user, reason);

		message += MessageBuilder.getCakeDay(user);
		return message;
	}

	/**
	 *
	 * @param reason encoded string that is the reason
	 */
	private static getReasonModifier(user: IUser, reason?: string): string {
		let reasonMessage = '.';
		if (!reason || !user) {
			return reasonMessage;
		}

		const decodedReason = reason.decode();
		if (user.reasons.get(reason) === 1 || user.reasons.get(reason) === -1) {
			if (user.score === 1 || user.score === -1) {
				reasonMessage = ` for ${decodedReason}`;
			} else {
				reasonMessage = `, ${user.reasons.get(reason)} of which is for ${decodedReason}`;
			}
		} else if (user.reasons.get(reason) === 0) {
			reasonMessage = `, none of which are for ${decodedReason}`;
		} else {
			reasonMessage = `, ${user.reasons.get(reason)} of which are for ${decodedReason}`;
		}
		if (!reasonMessage.endsWithPunctuation()) {
			reasonMessage += '.';
		}
		return reasonMessage;
	}

	private static getScoreFlare(score: number, scoreStr: string): string {
		if (score % 100 === 0) {
			let scoreFlareStr = score.toString();
			if (score === 0) {
				scoreFlareStr = 'zero';
			}
			const extraFlare = `:${scoreFlareStr}:`;
			return `${extraFlare} ${scoreStr} ${extraFlare}`;
		}
		return scoreStr;
	}

	private static getCryptoScore(user: IUser) {
		if (user.accountLevel && user.accountLevel > 1) {
			const str = ` (${user.pointdPalToken} PointdPal ${'Token'.pluralize(user.pointdPalToken)})`;
			return Md.bold(str);
		}
		return '';
	}

	private static getCakeDay(user: IUser) {
		if (user.pointdPalDay.isCakeDay()) {
			const yearsAsString = user.pointdPalDay.getYearsAsString();
			return `\n:birthday: Today is ${Md.user(user.slackId)}'s ${yearsAsString} Pointd Pal day! :birthday:`;
		}
		return '';
	}
}
