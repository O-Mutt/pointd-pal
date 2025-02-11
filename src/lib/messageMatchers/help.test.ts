import { describe, it } from 'node:test';
import { strictEqual } from 'node:assert/strict';
import { helpRegexp, versionRegexp, howMuchArePtsWorthRegexp } from './help';

// We recommend installing an extension to run jest tests.

describe('helpRegexp', () => {
	it('matches help', () => {
		strictEqual(helpRegexp.test('help'), true);
	});

	it('matches capital help', () => {
		strictEqual(helpRegexp.test('HELP'), true);
	});

	it('matches -h', () => {
		strictEqual(helpRegexp.test('-h'), true);
	});

	it('matches capital -h', () => {
		strictEqual(helpRegexp.test('-H'), true);
	});

	it('matches --help', () => {
		strictEqual(helpRegexp.test('--help'), true);
	});

	it('matches mIxEdCaSe --help', () => {
		strictEqual(helpRegexp.test('--HeLP'), true);
	});
});

describe('versionRegexp', () => {
	it('matches all version triggers', () => {
		strictEqual(versionRegexp.test('pointdpal version'), true);
		strictEqual(versionRegexp.test('pointd-pal version'), true);
		strictEqual(versionRegexp.test('plusplus version'), true);
		strictEqual(versionRegexp.test('-v'), true);
		strictEqual(versionRegexp.test('--version'), true);
	});

	it('does not match unrelated text', () => {
		strictEqual(versionRegexp.test('test versioning'), false);
	});
});

describe('howMuchArePtsWorthRegexp', () => {
	it('matches "how much are X points worth"', () => {
		strictEqual(howMuchArePtsWorthRegexp.test('how much are 10 points worth'), true);
	});

	it('matches "how much X points worth"', () => {
		strictEqual(howMuchArePtsWorthRegexp.test('how much 100 points worth'), true);
	});

	it('does not match unrelated phrases', () => {
		strictEqual(howMuchArePtsWorthRegexp.test('how many points do I have'), false);
	});
});
