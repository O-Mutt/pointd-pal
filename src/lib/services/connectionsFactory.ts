import { config } from '@config';

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
	host: config.get('postgres.host'),
	user: config.get('postgres.username'),
	max: 20,
	idleTimeoutMillis: 30000,
	connectionTimeoutMillis: 2000,
});

const connections: { [key: string]: pg.Connection } = {};
export function connectionFactory(teamId?: string): mongoose.Connection {
	const databaseName = teamId || procVars.defaultDb || '';
	if (connections[databaseName]) {
		return connections[databaseName];
	}

	const connectionUri = procVars.mongoUri.replace('#TEAM_ID', teamId || procVars.defaultDb || '');
	connections[databaseName] = mongoose.createConnection(`${connectionUri}`);
	return connections[databaseName];
}
