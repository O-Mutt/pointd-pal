import { withNamespace } from '@/logger';
import pluralize from 'pluralize';

const logger = withNamespace('StringUtil');
export class StringUtil {
	static pluralize(noun: string, countable: unknown, includeNumberPrefix = false): string {
		if (Array.isArray(countable)) {
			return pluralize(noun, countable.length, includeNumberPrefix);
		} else if (typeof countable === 'number') {
			return pluralize(noun, countable, includeNumberPrefix);
		} else if (typeof countable === 'object') {
			return pluralize(noun, Object.keys(countable ?? {}).length, includeNumberPrefix);
		}
		logger.error('pluralize expects an array or a number');
		return '';
	}

	static cleanAndEncode(str: string | null | undefined): string | undefined {
		if (!str) {
			return;
		}

		// this should fix a dumb issue with mac quotes
		const trimmed = JSON.parse(JSON.stringify(str.trim().toLowerCase())) as string;
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

	static obfuscate(str: string, amountToLeaveUnobfuscated = 3): string {
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

	static endsWithPunctuation(str: string): boolean {
		return !!str.match(/[.,:!?]$/);
	}

	static capitalizeFirstLetter(str: string): string {
		if (!str) {
			return '';
		}
		return str.charAt(0).toUpperCase() + str.slice(1);
	}
}

declare global {
	interface String {
		pluralize(countable: unknown, includeNumberPrefix?: boolean): string;
		cleanAndEncode(): string | undefined;
		decode(): string | undefined;
		obfuscate(amountToLeaveUnobfuscated?: number): string;
		reverse(): string;
		endsWithPunctuation(): boolean;
		capitalizeFirstLetter(): string;
	}
}

String.prototype.pluralize = function (countable: unknown, includeNumberPrefix = false): string {
	return StringUtil.pluralize(this.toString(), countable, includeNumberPrefix);
};
String.prototype.cleanAndEncode = function (): string {
	return StringUtil.cleanAndEncode(this.toString()) ?? '';
};

String.prototype.decode = function (): string {
	return StringUtil.decode(this.toString()) ?? '';
};

String.prototype.obfuscate = function (amountToLeaveUnobfuscated = 3): string {
	return StringUtil.obfuscate(this.toString(), amountToLeaveUnobfuscated);
};

String.prototype.reverse = function (): string {
	return StringUtil.reverse(this.toString());
};

String.prototype.endsWithPunctuation = function (): boolean {
	return StringUtil.endsWithPunctuation(this.toString());
};

String.prototype.capitalizeFirstLetter = function (): string {
	return StringUtil.capitalizeFirstLetter(this.toString());
};
