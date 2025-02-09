import config from '@config';

const scoreKeyword = config.get('scoreKeywords').join('|');
const reasonConjunctions = config.get('reasonConjunctions').join('|');

export class RegExpCreator {
	userObject = `<@(?<userId>[^>|]+)(?:\\|(?<label>[^>]+))?>`;
	multiUserSeparator = `(?:\\,|\\s|(?:\\s)?\\:(?:\\s)?)`;
	// allow for spaces after the thing being upvoted (@user ++)
	allowSpacesAfterObject = `\\s*`;
	positiveOperators = `\\+\\+|:clap:(?::skin-tone-[0-9]:)?|:thumbsup:(?::skin-tone-[0-9]:)?|:thumbsup_all:|:\\+1:(?::skin-tone-[0-9]:)?`;
	negativeOperators = `--|—|\\u2013|\\u2014|:thumbsdown:(?::skin-tone-[0-9]:)?`;
	operator = `(?<operator>${this.positiveOperators}|${this.negativeOperators})`;
	reasonForVote = `(?:\\s+(?<conjunction>${reasonConjunctions})?\\s*(?<reason>.+))?`;
	eol = `$`;
	topOrBottom = '(?<topOrBottom>top|bottom)';
	digits = '(?<digits>\\d+)';

	/**
	 * user1++ for being dope
	 * user1-- cuz nope
	 * billy @bob++
	 */
	createUpDownVoteRegExp(): RegExp {
		return new RegExp(
			`(?<premessage>.*)?${this.userObject}${this.allowSpacesAfterObject}${this.operator}${this.reasonForVote}${this.eol}`,
			'i',
		);
	}

	createMultiUserVoteRegExp(): RegExp {
		// the thing being upvoted, which is any number of words and spaces
		const multiUserVotedObject = `(?<premessage>.*)?(?:\\{|\\[|\\()\\s?(?<allUsers>(?:${this.userObject}${this.multiUserSeparator}?(?:\\s)?)+)\\s?(?:\\}|\\]|\\))`;

		return new RegExp(
			`${multiUserVotedObject}${this.allowSpacesAfterObject}${this.operator}${this.reasonForVote}${this.eol}`,
			'i',
		);
	}

	/**
	 * botName top 100
	 * botName bottom 3
	 */
	createTopBottomRegExp(): RegExp {
		return new RegExp(`${this.topOrBottom}${this.allowSpacesAfterObject}${this.digits}`, 'i');
	}

	createTopBottomTokenRegExp(): RegExp {
		return new RegExp(
			`${this.topOrBottom}${this.allowSpacesAfterObject}tokens${this.allowSpacesAfterObject}${this.digits}`,
			'i',
		);
	}

	createTopPointGiversRegExp(): RegExp {
		return new RegExp(
			`${this.topOrBottom}${this.allowSpacesAfterObject}(?:point givers?|point senders?|givers?|senders?)${this.allowSpacesAfterObject}${this.digits}`,
			'i',
		);
	}

	/**
	 * botName score for user1
	 */
	createAskForScoreRegExp(): RegExp {
		return new RegExp(`(.*)?(?:${scoreKeyword})\\s(\\w+\\s)?${this.userObject}`, 'i');
	}

	/**
	 * botName erase user1
	 * botName erase user2 because they quit and i don't like quitters
	 */
	createEraseUserScoreRegExp(): RegExp {
		const eraseClause = '(?:erase)';

		return new RegExp(
			`(?<premessage>.*)?${eraseClause}${this.allowSpacesAfterObject}${this.userObject}${this.allowSpacesAfterObject}${this.reasonForVote}${this.eol}`,
			'i',
		);
	}

	/**
	 *
	 * @returns user1 + # for being the best
	 */
	createGiveTokenRegExp(): RegExp {
		const reg = new RegExp(
			`(?<premessage>.*)?${this.userObject}${this.allowSpacesAfterObject}\\+${this.allowSpacesAfterObject}(?<amount>[0-9]{1,})${this.reasonForVote}${this.eol}`,
			'i',
		);
		return reg;
	}

	/**
	 * @hubot level me up
	 */
	createLevelUpAccount(): RegExp {
		return new RegExp(/(level (me )?up|upgrade (my account|me))/, 'i');
	}

	/**
	 * @hubot help
	 */
	getHelp(): RegExp {
		return new RegExp(`(help|-h|--help)${this.eol}`, 'i');
	}

	/**
	 * @hubot hot-wallet or hot wallet or hotwallet
	 */
	getBotWallet(): RegExp {
		return new RegExp(/hot( |-)?wallet/, 'i');
	}
}

export const regExpCreator = new RegExpCreator();
