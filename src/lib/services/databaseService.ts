import { type IUser } from '@/entities/user';
import { config } from '@/config';

import { Client, type QueryResultRow } from 'pg';
import { subMinutes } from 'date-fns';
import { withNamespace } from '@/logger';
import * as userService from '@/lib/services/userService';
import * as botTokenService from '@/lib/services/botTokenService';
import { eventBus } from '@/lib/services/eventBus';
import type { FlywayConfig } from 'node-flyway/dist/types/types';

const logger = withNamespace('databaseService');

const clients = new Map<string, Client>();

export function getFlywayConnectionConfig(teamId: string): FlywayConfig {
	return {
		url: `jdbc:postgresql://${config.get('postgres.host')}:${config.get('postgres.port')}/${getDatabaseNameFromTeamId(teamId)}`,
		user: config.get('postgres.username'),
		password: config.get('postgres.password'),
		defaultSchema: config.get('postgres.schema'),
		migrationLocations: ['migrations/sql'],
		advanced: {
			baselineOnMigrate: true,
			createSchemas: true,
		},
	};
}

export async function getConnection(teamId?: string): Promise<Client> {
	let client: Client;
	// we will use the tenant specific database as the database name _and_ the map key to get the client for connection
	const teamOrRoot = getDatabaseNameFromTeamId(teamId);
	if (clients.has(teamOrRoot)) {
		// we already have this connection in the map
		client = clients.get(teamOrRoot)!;
	} else {
		// new connection needed
		client = new Client({
			host: config.get('postgres.host'),
			user: config.get('postgres.username'),
			database: teamOrRoot,
			password: config.get('postgres.password'),
			keepAlive: true,
			connectionTimeoutMillis: 2000,
		});
		// connect to the database
		await client.connect();
		// store the connection in the map
		clients.set(teamOrRoot, client);
	}

	// do we already track the errors on connection?
	if (client.listeners('error').length === 0) {
		client.on('error', (e: Error) => onConnectionCloseOrError(e, teamOrRoot));
	}

	return client;
}

function onConnectionCloseOrError(e: Error, key: string) {
	logger.info(`connection for ${key} closed, we will remove it from the map of connections`, e);
	clients.delete(key);
}

export async function isSpam(teamId: string, to: IUser, from: IUser) {
	logger.debug('spam check');
	const connection = await getConnection(teamId);
	const nMinutesAgo = config.get('spam.timeout');
	// There is 1+ and that means we have spam
	const result = await connection.query<{ count: number }>(
		`
		SELECT COUNT(*) as count
		FROM score_logs
		WHERE
			"to" = '${to.id}' AND
			"from" = '${from.id}' AND
			"date" >= now() - INTERVAL '${nMinutesAgo} MINUTES'
		`,
		[],
	);
	const isSpam = result.rows[0].count > 0;

	logger.debug('spam check result', isSpam);
	return isSpam;
}

export async function updateAccountLevelToTwo(user: IUser): Promise<void> {
	user.token = user.score;
	user.accountLevel = 2;
	await userService.update(user.teamId, user);

	await botTokenService.subtractTokens(user.token);
	eventBus.emit('plusplus-tokens');
	return;
}

/**
 *
 * @param {object} user the user receiving the points
 * @param {object} from the user sending the points
 * @param {number} scoreChange the increment in which the user is getting/losing points
 * @returns {object} the user who received the points updated value
 */
export async function transferTokens(teamId: string, user: IUser, from: IUser, scoreChange: number): Promise<void> {
	user.token = user.token || 0 + scoreChange;
	from.token = from.token || 0 - scoreChange;
	await userService.update(teamId, user);
	await userService.update(teamId, from);
	return;
}

export function getDatabaseNameFromTeamId(teamId?: string) {
	return teamId ? `${config.get('postgres.database')}_${teamId.toLowerCase()}` : config.get('postgres.database');
}
