import { IUser } from '@/entities/user';
import { config } from '@/config';

import { Client, Connection } from 'pg';
import { subMinutes } from 'date-fns';
import { withNamespace } from '@/logger';
import * as userService from '@/lib/services/userService';
import * as botTokenService from '@/lib/services/botTokenService';
import { eventBus } from '@/lib/services/eventBus';

const logger = withNamespace('databaseService');
const rootDb = new Client({
	host: config.get('postgres.host'),
	user: config.get('postgres.username'),
	database: config.get('postgres.database'),
	keepAlive: true,
	idleTimeoutMillis: 30000,
	connectionTimeoutMillis: 2000,
});

const connections: { [key: string]: Connection } = {};
export async function getConnection(teamId?: string): Promise<Connection> {
	if (!teamId) {
		return (connections['root'] = connections['root'] || (await rootDb.connect()));
	} else if (!connections[teamId]) {
		const teamConnection = new Client({
			host: config.get('postgres.host'),
			user: config.get('postgres.username'),
			database: teamId,
			keepAlive: true,
			idleTimeoutMillis: 30000,
			connectionTimeoutMillis: 2000,
		});
		connections[teamId] = await teamConnection.connect();
	}
	return connections[teamId];
}

export async function isSpam(teamId: string, to: IUser, from: IUser) {
	logger.debug('spam check');
	const connection = await getConnection(teamId);
	const fiveMinutesAgo = subMinutes(new Date(), config.get('spam.timeout'));
	// There is 1+ and that means we have spam
	const result = await connection.query(
		`
		SELECT COUNT(*) FROM score_logs
		WHERE to = $1 AND from = $2 AND date >= $3
		`,
	);
	const isSpam = result.rows[0].count > 0;

	logger.debug('spam check result', isSpam);
	return isSpam;
}

export async function updateAccountLevelToTwo(user: IUser): Promise<void> {
	user.pointdPalToken = user.score;
	user.accountLevel = 2;
	await userService.update(user.teamId, user);

	await botTokenService.subtractTokens(user.pointdPalToken);
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
	user.pointdPalToken = user.pointdPalToken || 0 + scoreChange;
	from.pointdPalToken = from.pointdPalToken || 0 - scoreChange;
	await userService.update(teamId, user);
	await userService.update(teamId, from);
	return;
}
