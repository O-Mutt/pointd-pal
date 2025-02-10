import config from '@config';

const reasonConjunctions = config.get('reasonConjunctions').join('|');

export const userObject = `<@(?<userId>[^>|]+)(?:\\|(?<label>[^>]+))?>`;
export const multiUserSeparator = `(?:\\,|\\s|(?:\\s)?\\:(?:\\s)?)`;
// allow for spaces after the thing being upvoted (@user ++)
export const allowSpacesAfterObject = `\\s*`;

// @user++
const basicPlusPlus = `\\+\\+`;
// allows :skin-tone-[0-9]: optional modifier
const optionalSkinToneAdditions = `(?:skin-tone-[0-9]:)?`;
// @user :clap: or @user :clap::skin-tone-2:
const clapPlusPlus = `:clap:${optionalSkinToneAdditions}`;
// @user :clap: or @user :clap::skin-tone-2:
const thumbsUpPlusPlus = `:thumbsup:${optionalSkinToneAdditions}`;
// @user +1 or @user +1:skin-tone-2: (this is also a :thumbsup:)
const plusOnePlusPlus = `\\+1:${optionalSkinToneAdditions}`;
const thumbsUpAllPlusPlus = `:thumbsup_all:`;
export const positiveOperatorsRegexp = `${basicPlusPlus}|${clapPlusPlus}|${thumbsUpPlusPlus}|${thumbsUpAllPlusPlus}|${plusOnePlusPlus}`;

// @user--
const basicMinusMinus = `--`;
// @user—
const unicodeMinusMinus = `—`;
// @user–
const enDashMinusMinus = `\\u2013`;
// @user—
const emDashMinusMinus = `\\u2014`;
// @user :thumbsdown: or @user :thumbsdown::skin-tone-2:
const thumbsDownMinusMinus = `:thumbsdown:${optionalSkinToneAdditions}`;
export const negativeOperatorsRegexp = `${basicMinusMinus}|${unicodeMinusMinus}|${enDashMinusMinus}|${emDashMinusMinus}|${thumbsDownMinusMinus}`;

export const namedOperatorRegexp = `(?<operator>${positiveOperatorsRegexp}|${negativeOperatorsRegexp})`;
export const namedPositiveOperatorRegexp = `(?<operator>${positiveOperatorsRegexp})`;
export const namedNegativeOperatorRegexp = `(?<operator>${negativeOperatorsRegexp})`;

const optionalNamedConjunction = `(?:\\s+(?<conjunction>${reasonConjunctions})?`;

export const namedConjunctionAndReasonsRegexp = `${optionalNamedConjunction}${allowSpacesAfterObject}(?<reason>.+))?`;

export const namedTopOrBottomRegexp = '(?<topOrBottom>top|bottom)';
export const namedTopRegexp = '(?<topOrBottom>top)';
export const namedBottomRegexp = '(?<topOrBottom>bottom)';

export const namedNDigitsRegexp = '(?<digits>\\d+)';

export const eol = `$`;
