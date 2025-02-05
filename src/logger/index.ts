import adze, { Level, setup } from 'adze';
import { config } from '@/config';

setup({
	activeLevel: config.get('logLevel') as Level | number,
	meta: {
		app: 'Pointd-Pal',
	},
	middleware: [], // consider a critical middleware to capture errors to server logging
	showTimestamp: true,
	withEmoji: true,
});

export const logger = adze.seal();
export const withNamespace = (namespace: string) => {
	return logger.ns(namespace).seal();
};
export default logger;
