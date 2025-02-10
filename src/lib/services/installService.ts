import type { IInstallation } from '@/models/installation';
import { Flyway } from 'node-flyway';

import { withNamespace } from '@/logger';

import { DatabaseService, databaseService } from '@/lib/services';

import type { Installation } from '@slack/oauth';
import type { Client } from 'pg';

export class InstallService {
	constructor(private logger = withNamespace('installService')) {}

	async findAll(): Promise<IInstallation[]> {
		const connection = await databaseService.getConnection();
		const result = await connection.query<IInstallation>(`
		SELECT
			${this.getAliasedFieldsAsCamelCase()}
		FROM installations`);
		return result.rows;
	}

	async findOne(teamId: string): Promise<IInstallation | null> {
		const connection = await databaseService.getConnection();
		const result = await connection.query<IInstallation>(
			`
		SELECT
			${this.getAliasedFieldsAsCamelCase()}
		FROM installations
		WHERE team_id = $1`,
			[teamId],
		);
		if (result.rows.length === 1) {
			return result.rows[0];
		}
		return null;
	}

	async create(teamId: string, installation: Installation, installedBy: string): Promise<IInstallation> {
		this.logger.info(`Creating installation for ${teamId}`);
		let connection: Client | undefined;
		try {
			connection = await databaseService.getConnection();
			await connection.query('BEGIN TRANSACTION');
			const result = await connection.query<IInstallation>(
				`INSERT INTO installations
			(team_id, installation, created_by, updated_by, is_enterprise)
		VALUES
			($1, $2, $3, $4, $5)
		ON CONFLICT (team_id) DO UPDATE SET
			team_id = $1,
			installation = $2,
			updated_at = now(),
			updated_by = $4,
			is_enterprise = $5
		RETURNING
			${this.getAliasedFieldsAsCamelCase()}
		`,
				[
					teamId,
					JSON.stringify(installation),
					installedBy ?? 'anon@install',
					installedBy ?? 'anon@install',
					installation.isEnterpriseInstall && installation.enterprise !== undefined,
				],
			);
			const newInstall = result.rows[0];

			if (teamId && newInstall) {
				const result = await connection.query('SELECT 1 FROM pg_database WHERE datname = $1', [
					DatabaseService.getDatabaseNameFromTeamId(teamId),
				]);
				if (result.rowCount === 0 && result.rows[0] !== 1) {
					this.logger.info(
						`Installation created for ${teamId} creating the database now. (DB: ${DatabaseService.getDatabaseNameFromTeamId(teamId)})`,
					);

					// cannot create a database in a transaction
					await connection.query('COMMIT');
					// This blows up on secondary installs
					await connection.query(`CREATE DATABASE ${DatabaseService.getDatabaseNameFromTeamId(teamId)}`);
					await connection.query('BEGIN TRANSACTION');
				} else {
					await connection.query('COMMIT');
					this.logger.info(
						`Database (${DatabaseService.getDatabaseNameFromTeamId(teamId)}) already exists for ${teamId}. Skipped creation but will run migrations now.`,
					);
				}
			}
			this.logger.info('New database has been created, running baseline migrations now');
			const flywayResult = await new Flyway(DatabaseService.getFlywayConnectionConfig(teamId)).migrate();
			this.logger.info(`Migration result`, flywayResult, '\n\n');
			return newInstall;
		} catch (e: unknown) {
			this.logger.error(
				'Error creating installation, is connection created:',
				!!connection,
				(e as Error).message,
				'\n\nwe will attempt a rollback of the install transaction',
			);
			await connection?.query('ROLLBACK');
			throw e;
		}
	}

	async deleteOne(teamId: string): Promise<void> {
		const connection = await databaseService.getConnection();
		await connection.query(
			`DELETE FROM installations
		 WHERE team_id = $1`,
			[teamId],
		);
	}

	async migrateAll(): Promise<void> {
		const allInstallations = await this.findAll();
		this.logger.info(`We found ${allInstallations.length} installations to migrate`);
		for (const install of allInstallations) {
			this.logger.info(`Migrating ${install.teamId}`);
			const result = await new Flyway(DatabaseService.getFlywayConnectionConfig(install.teamId)).migrate();
			this.logger.info(`Migration result`, result, '\n\n');
		}
	}

	private getAliasedFieldsAsCamelCase() {
		return `
	id,
	team_id as "teamId",
	team_name as "teamName",
	customer_id as "customerId",
	is_enterprise as "isEnterprise",
	is_enabled as "isEnabled",
	installation,
	created_at as "createdAt",
	created_by as "createdBy",
	updated_at as "updatedAt",
	updated_by as "updatedBy"
	`;
	}
}
export const installService = new InstallService();
