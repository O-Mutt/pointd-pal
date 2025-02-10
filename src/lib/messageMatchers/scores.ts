import config from '@config';
import { userObject } from './constants';

const scoreKeyword = config.get('scoreKeywords').join('|');

export const askForUserScoreRegexp = new RegExp(`(.*)?(?:${scoreKeyword})\\s(\\w+\\s)?${userObject}`, 'i');
