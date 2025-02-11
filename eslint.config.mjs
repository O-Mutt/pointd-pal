import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import jestPlugin from 'eslint-plugin-jest';
import tseslint from 'typescript-eslint';
import eslint from '@eslint/js';
import globals from 'globals';

export default tseslint.config(
	{
		ignores: ['**/node_modules/**', '**/dist/**'],
	},
	eslint.configs.recommended,
	tseslint.configs.recommendedTypeChecked,
	tseslint.configs.stylistic,
	eslintPluginPrettierRecommended,
	{
		plugins: {
			'@typescript-eslint': tseslint.plugin,
			jest: jestPlugin,
		},
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				projectService: true,
			},
		},
	},
	{
		// disable type-aware linting on JS files
		files: ['**/*.js'],
		extends: [tseslint.configs.disableTypeChecked],
	},
	{
		// enable jest rules on test files
		files: ['test/**', '**/*.test.*', '**/*.spec.*'],
		extends: [jestPlugin.configs['flat/recommended']],
		rules: {
			'@typescript-eslint/no-floating-promises': 'off',
		},
		languageOptions: {
			globals: {
				...globals.node,
			},
		},
	},
	{
		// ignore unused vars if they are prefixed with _
		rules: {
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
				},
			],
		},
	},
);
