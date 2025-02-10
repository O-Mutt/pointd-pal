import { allowSpacesAfterObject, eol, namedConjunctionAndReasonsRegexp, userObject } from './constants';

export const giveTokenRegexp = new RegExp(
	`(?<premessage>.*)?${userObject}${allowSpacesAfterObject}\\+${allowSpacesAfterObject}(?<amount>[0-9]{1,})${namedConjunctionAndReasonsRegexp}${eol}`,
	'i',
);
