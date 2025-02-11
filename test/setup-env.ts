import { after, before } from 'node:test';

const beforeValues = {
	SLACK_SIGNING_SECRET: process.env.SLACK_SIGNING_SECRET,
	SLACK_CLIENT_ID: process.env.SLACK_CLIENT_ID,
	SLACK_CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET,
	SLACK_STATE_SECRET: process.env.SLACK_STATE_SECRET,
	SLACK_APP_TOKEN: process.env.SLACK_APP_TOKEN,
};

before(() => {
	process.env.SLACK_SIGNING_SECRET = 'slack-signing-secret';
	process.env.SLACK_CLIENT_ID = 'slack-client-id';
	process.env.SLACK_CLIENT_SECRET = 'slack-client-secret';
	process.env.SLACK_STATE_SECRET = 'i_m_super_secret';
	process.env.SLACK_APP_TOKEN = '123-token';
});

after(() => {
	process.env.SLACK_SIGNING_SECRET = beforeValues.SLACK_SIGNING_SECRET;
	process.env.SLACK_CLIENT_ID = beforeValues.SLACK_CLIENT_ID;
	process.env.SLACK_CLIENT_SECRET = beforeValues.SLACK_CLIENT_SECRET;
	process.env.SLACK_STATE_SECRET = beforeValues.SLACK_STATE_SECRET;
	process.env.SLACK_APP_TOKEN = beforeValues.SLACK_APP_TOKEN;
});
