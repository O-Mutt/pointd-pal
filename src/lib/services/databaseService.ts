import { IUser } from '@/entities/user';
import { config } from '@/config';

import { Client } from 'pg';
import { subMinutes } from 'date-fns';
import { withNamespace } from '@/logger';
import * as userService from '@/services/userService';
import * as botTokenService from '@/services/botTokenService';
import { eventBus } from '@/services/eventBus';

const logger = withNamespace('databaseService');

const clients = new Map<string, Client>();

export async function getConnection(teamId?: string): Promise<Client> {
	if (!teamId) {
		let rootClient: Client;
		if (clients.has('root')) {
			rootClient = clients.get('root')!;
		} else {
			rootClient = new Client({
				host: config.get('postgres.host'),
				user: config.get('postgres.username'),
				database: config.get('postgres.database'),
				keepAlive: true,
				connectionTimeoutMillis: 2000,
			});
			clients.set('root', rootClient);
			rootClient.on('error', onConnectionCloseOrError);
		}
		await rootClient.connect();
		return rootClient;
	} else {
		let teamClient: Client;
		if (clients.has(teamId)) {
			teamClient = clients.get(teamId)!;
		} else {
			teamClient = new Client({
				host: config.get('postgres.host'),
				user: config.get('postgres.username'),
				database: `${config.get('postgres.database')}_${teamId}`,
				keepAlive: true,
				connectionTimeoutMillis: 2000,
			});
			clients.set(teamId, teamClient);
			teamClient.on('error', onConnectionCloseOrError);
		}
		await teamClient.connect();
		return teamClient;
	}
}

function onConnectionCloseOrError() {
	logger.debug('connection closed');
}

export async function isSpam(teamId: string, to: IUser, from: IUser) {
	logger.debug('spam check');
	const connection = await getConnection(teamId);
	const fiveMinutesAgo = subMinutes(new Date(), config.get('spam.timeout'));
	// There is 1+ and that means we have spam
	const result = await connection.query<{ count: number }>(
		`
		SELECT COUNT(*) as count FROM score_logs
		WHERE to = $1 AND from = $2 AND date >= $3
		`,
		[to.id, from.id, fiveMinutesAgo],
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
