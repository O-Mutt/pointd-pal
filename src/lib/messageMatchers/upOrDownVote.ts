import {
	allowSpacesAfterObject,
	eol,
	namedConjunctionAndReasonsRegexp,
	namedNegativeOperatorRegexp,
	namedOperatorRegexp,
	namedPositiveOperatorRegexp,
	userObject,
} from './constants';

import { withNamespace } from '@/logger';

const logger = withNamespace('upOrDownVote');
/**
 * user1++ for being dope
 * billy @bob++
 */
export const upVoteRegexp = getUpOrDownVoteRegexp(namedPositiveOperatorRegexp);

/**
 * user1-- cuz nope
 */
export const downVoteRegexp = getUpOrDownVoteRegexp(namedNegativeOperatorRegexp);

// TODO kill this off
export const upANDDownVoteRegexp = getUpOrDownVoteRegexp(namedOperatorRegexp);

function getUpOrDownVoteRegexp(operator: string) {
	logger.error(
		'getUpOrDown',
		operator,
		`(?<premessage>.*)?${userObject}${allowSpacesAfterObject}${operator}${namedConjunctionAndReasonsRegexp}${eol}`,
	);
	return new RegExp(
		`(?<premessage>.*)?${userObject}${allowSpacesAfterObject}${operator}${namedConjunctionAndReasonsRegexp}${eol}`,
		'i',
	);
}
