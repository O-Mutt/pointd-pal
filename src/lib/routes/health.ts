import { CustomRoute } from '@slack/bolt/dist/receivers/SocketModeReceiver';
import { IncomingMessage, ServerResponse } from 'http';

export const healthEndpoint: CustomRoute = {
	path: '/health',
	method: ['HEAD', 'GET'],
	handler: (req: IncomingMessage, res: ServerResponse) => {
		res.writeHead(200);
		res.end();
		return;
	},
};
