import type { IUser } from '@/models/user';
import { Client } from 'pg';

import { config } from '@/config';
import { botTokenService, eventBus, userService } from '@/lib/services';
import { withNamespace } from '@/logger';

import type { FlywayConfig } from 'node-flyway/dist/types/types';

export class DatabaseService {
	constructor(
		private logger = withNamespace('databaseService'),
		private clients = new Map<string, Client>(),
	) {}

	async getConnection(teamId?: string): Promise<Client> {
		let client: Client;
		// we will use the tenant specific database as the database name _and_ the map key to get the client for connection
		const teamOrRoot = DatabaseService.getDatabaseNameFromTeamId(teamId);
		if (this.clients.has(teamOrRoot)) {
			// we already have this connection in the map
			client = this.clients.get(teamOrRoot)!;
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
			this.clients.set(teamOrRoot, client);
		}

		// do we already track the errors on connection?
		if (client.listeners('error').length === 0) {
			client.on('error', (e: Error) => this.onConnectionCloseOrError(e, teamOrRoot));
		}

		return client;
	}

	onConnectionCloseOrError(e: Error, key: string) {
		this.logger.info(`connection for ${key} closed, we will remove it from the map of connections`, e);
		this.clients.delete(key);
	}

	async updateAccountLevelToTwo(user: IUser): Promise<void> {
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
	async transferTokens(teamId: string, user: IUser, from: IUser, scoreChange: number): Promise<void> {
		user.token = user.token || 0 + scoreChange;
		from.token = from.token || 0 - scoreChange;
		await userService.update(teamId, user);
		await userService.update(teamId, from);
		return;
	}

	static getFlywayConnectionConfig(teamId: string): FlywayConfig {
		return {
			url: `jdbc:postgresql://${config.get('postgres.host')}:${config.get('postgres.port')}/${DatabaseService.getDatabaseNameFromTeamId(teamId)}`,
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

	static getDatabaseNameFromTeamId(teamId?: string) {
		return teamId ? `${config.get('postgres.database')}_${teamId.toLowerCase()}` : config.get('postgres.database');
	}
}

export const databaseService = new DatabaseService();
