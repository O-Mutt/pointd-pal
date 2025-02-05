import { withNamespace } from '@/logger';

const logger = withNamespace('NumberUtil');
export class NumberUtil {
	static randomInt(min = 1, max = 0): number {
		logger.debug('randomInt', { min, max });
		const lower = Math.ceil(Math.min(min, max));
		const upper = Math.floor(Math.max(min, max));
		return Math.floor(lower + Math.random() * (upper - lower + 1));
	}

	static random(min = 1, max = 0): number {
		const lower = Math.min(min, max);
		const upper = Math.max(min, max);
		return lower + Math.random() * (upper - lower + 1);
	}
}

// declare global {
// 	interface Number {}
// }
