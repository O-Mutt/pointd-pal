const config = {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
	'*': (stagedFiles) => `eslint ${stagedFiles.join(' ')}`,
	'*.ts': 'npm run build',
};

export default config;
