import { allowSpacesAfterObject, namedBottomRegexp, namedNDigitsRegexp, namedTopRegexp } from './constants';

export const topRegexp = getTopOrBottomRegexp(namedTopRegexp);
export const bottomRegexp = getTopOrBottomRegexp(namedBottomRegexp);

export const topTokensRegexp = getTopOrBottomRegexp(namedTopRegexp, 'tokens');
export const bottomTokensRegexp = getTopOrBottomRegexp(namedBottomRegexp, 'tokens');

const namedGiversRegexp = '(?:point givers?|point senders?|givers?|senders?)';
export const topGiversRegexp = getTopOrBottomRegexp(namedTopRegexp, namedGiversRegexp);
export const bottomGiversRegexp = getTopOrBottomRegexp(namedBottomRegexp, namedGiversRegexp);

function getTopOrBottomRegexp(topOrBottom: string, typeToFind = '') {
	if (typeToFind) {
		typeToFind = `${typeToFind}${allowSpacesAfterObject}`;
	}
	return new RegExp(`${topOrBottom}${allowSpacesAfterObject}${typeToFind}${namedNDigitsRegexp}`, 'i');
}
