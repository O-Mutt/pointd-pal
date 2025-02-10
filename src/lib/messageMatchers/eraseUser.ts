import { allowSpacesAfterObject, eol, namedConjunctionAndReasonsRegexp, userObject } from './constants';

const eraseClause = '(?:erase)';

export const eraseScoreRegexp = new RegExp(
	`(?<premessage>.*)?${eraseClause}${allowSpacesAfterObject}${userObject}${allowSpacesAfterObject}${namedConjunctionAndReasonsRegexp}${eol}`,
	'i',
);
