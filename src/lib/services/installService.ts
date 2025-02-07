import { type IInstallation } from '@/entities/installation';
import { getConnection, getDatabaseNameFromTeamId, getFlywayConnectionConfig } from './databaseService';
import { type Installation } from '@slack/oauth';
import { Flyway } from 'node-flyway';
import { withNamespace } from '@/logger';

const logger = withNamespace('installService');
export async function findAll(): Promise<IInstallation[]> {
	const connection = await getConnection();
	const result = await connection.query<IInstallation>(`
		SELECT
			${getAliasedFieldsAsCamelCase()}
		FROM installations`);
	return result.rows;
}

export async function findOne(teamId: string): Promise<IInstallation | null> {
	const connection = await getConnection();
	const result = await connection.query<IInstallation>(
		`
		SELECT
			${getAliasedFieldsAsCamelCase()}
		FROM installations
		WHERE team_id = $1`,
		[teamId],
	);
	if (result.rows.length === 1) {
		return result.rows[0];
	}
	return null;
}

export async function create(teamId: string, installation: Installation, installedBy: string): Promise<IInstallation> {
	logger.info(`Creating installation for ${teamId}`);
	const connection = await getConnection();
	const result = await connection.query<IInstallation>(
		`INSERT INTO installations
			(team_id, installation, created_by, updated_by, is_enterprise)
		VALUES
			($1, $2, $3, $4, $5)
		RETURNING teamId, installation, createdBy, updatedBy, isEnterprise`,
		[
			teamId,
			JSON.stringify(installation),
			installedBy ?? 'anon@install',
			installedBy ?? 'anon@install',
			installation.isEnterpriseInstall && installation.enterprise !== undefined,
		],
	);
	const newInstall = result.rows[0];
	if (teamId) {
		logger.info(
			`Installation created for ${teamId} creating the database now. (DB: ${getDatabaseNameFromTeamId(teamId)})`,
		);
		await connection.query(`CREATE DATABASE ${getDatabaseNameFromTeamId(teamId)}`);
	}
	logger.info('New database has been created, running baseline migrations now');
	const flywayResult = await new Flyway(getFlywayConnectionConfig(teamId)).migrate();
	logger.info(`Migration result`, flywayResult, '\n\n');
	return newInstall;
}

export async function deleteOne(teamId: string): Promise<void> {
	const connection = await getConnection();
	await connection.query(
		`DELETE FROM installations
		 WHERE team_id = $1`,
		[teamId],
	);
}

export async function migrateAll(): Promise<void> {
	const allInstallations = await findAll();
	logger.info(`We found ${allInstallations.length} installations to migrate`);
	for (const install of allInstallations) {
		logger.info(`Migrating ${install.teamId}`);
		const result = await new Flyway(getFlywayConnectionConfig(install.teamId)).migrate();
		logger.info(`Migration result`, result, '\n\n');
	}
}

function getAliasedFieldsAsCamelCase() {
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
