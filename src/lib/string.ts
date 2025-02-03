import { withNamespace } from '@/logger';
import pluralize from 'pluralize';

const logger = withNamespace('StringUtil');
export class StringUtil {
	static pluralize(countable: any, noun: string) {
		if (Array.isArray(countable)) {
			return pluralize(countable.length, noun);
		} else if (typeof countable === 'number') {
			return pluralize(countable, noun);
		} else if (typeof countable === 'object') {
			return pluralize(Object.keys(countable).length, noun);
		} else {
			logger.error('pluralize expects an array or a number');
			return '';
		}
	}

	static cleanAndEncode(str: string | null | undefined): string | undefined {
		if (!str) {
			return;
		}

		// this should fix a dumb issue with mac quotes
		const trimmed = JSON.parse(JSON.stringify(str.trim().toLowerCase()));
		const buff = Buffer.from(trimmed);
		const base64data = buff.toString('base64');
		return base64data;
	}

	static decode(str?: string): string | undefined {
		if (!str) {
			return undefined;
		}

		const buff = Buffer.from(str, 'base64');
		const text = buff.toString('utf-8');
		return text;
	}

	static obfuscate(str: string, amountToLeaveUnobfuscated: number = 3): string {
		if (!str) {
			return str ?? '';
		}
		const backwards = str.reverse();
		let obfuscatedString = backwards;
		if (backwards.length > amountToLeaveUnobfuscated) {
			obfuscatedString =
				backwards.slice(0, amountToLeaveUnobfuscated) +
				backwards.slice(amountToLeaveUnobfuscated, str.length).replace(/./g, '*');
		}
		return obfuscatedString.reverse();
	}

	static reverse(str: string): string {
		return str.split('').reverse().join('');
	}
}

declare global {
	interface String {
		cleanAndEncode(): string | undefined;
		decode(): string | undefined;
		obfuscate(amountToLeaveUnobfuscated?: number): string;
		reverse(): string;
	}
}
String.prototype.cleanAndEncode = function (): string {
	return StringUtil.cleanAndEncode(this.toString()) ?? '';
};

String.prototype.decode = function (): string {
	return StringUtil.decode(this.toString()) ?? '';
};

String.prototype.obfuscate = function (amountToLeaveUnobfuscated: number = 3): string {
	return StringUtil.obfuscate(this.toString(), amountToLeaveUnobfuscated);
};

String.prototype.reverse = function (): string {
	return StringUtil.reverse(this.toString());
};
