import {
	allowSpacesAfterObject,
	eol,
	multiUserSeparator,
	namedConjunctionAndReasonsRegexp,
	namedOperatorRegexp,
	userObject,
} from './constants';

// the thing being upvoted, which is any number of words and spaces
const multiUserVotedObject = `(?<premessage>.*)?(?:\\{|\\[|\\()\\s?(?<allUsers>(?:${userObject}${multiUserSeparator}?(?:\\s)?)+)\\s?(?:\\}|\\]|\\))`;

export const multiUserVoteRegexp = new RegExp(
	`${multiUserVotedObject}${allowSpacesAfterObject}${namedOperatorRegexp}${namedConjunctionAndReasonsRegexp}${eol}`,
	'i',
);
