import { withNamespace } from '@/logger';

const logger = withNamespace('StringUtil');
export class StringUtil {
	static pluralSuffix(maybeArray: any): 's' | '' {
		if (Array.isArray(maybeArray)) {
			return maybeArray.length > 1 ? 's' : '';
		} else if (typeof maybeArray === 'number') {
			return maybeArray > 1 ? 's' : '';
		} else {
			logger.error('pluralSuffix expects an array or a number');
			return '';
		}
	}
}

declare global {
	interface Number {}
}
