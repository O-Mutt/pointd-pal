import { withNamespace } from '@/logger';
import pluralize from 'pluralize';

const logger = withNamespace('StringUtil');
export class StringExtensions {
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

	static camelToSnakeCase(str: string): string {
		return str.replace(/([a-z])([A-Z])/g, (matches) => `${matches[0]}_${matches[1].toLowerCase()}`);
	}

	static snakeToCamelCase(str: string): string {
		return str.replace(/(_\w)/g, (matches) => matches[1].toUpperCase());
	}
}

declare global {
	interface String {
		pluralize(countable: unknown, includeNumberPrefix?: boolean): string;
		obfuscate(amountToLeaveUnobfuscated?: number): string;
		reverse(): string;
		endsWithPunctuation(): boolean;
		capitalizeFirstLetter(): string;
		camelToSnakeCase(): string;
		snakeToCamelCase(): string;
	}
}

String.prototype.pluralize = function (countable: unknown, includeNumberPrefix = false): string {
	return StringExtensions.pluralize(this.toString(), countable, includeNumberPrefix);
};

String.prototype.obfuscate = function (amountToLeaveUnobfuscated = 3): string {
	return StringExtensions.obfuscate(this.toString(), amountToLeaveUnobfuscated);
};

String.prototype.reverse = function (): string {
	return StringExtensions.reverse(this.toString());
};

String.prototype.endsWithPunctuation = function (): boolean {
	return StringExtensions.endsWithPunctuation(this.toString());
};

String.prototype.capitalizeFirstLetter = function (): string {
	return StringExtensions.capitalizeFirstLetter(this.toString());
};

String.prototype.camelToSnakeCase = function (): string {
	return StringExtensions.camelToSnakeCase(this.toString());
};

String.prototype.snakeToCamelCase = function (): string {
	return StringExtensions.snakeToCamelCase(this.toString());
};
