import { IInstallation } from '@/entities/installation';
import { getConnection } from './databaseService';
import { Installation } from '@slack/oauth';

export async function findAll(): Promise<IInstallation[]> {
	const connection = await getConnection();
	const result = await connection.query(`SELECT * FROM installation`);
	return result.rows;
}

export async function findOne(teamId: string): Promise<IInstallation | null> {
	const connection = await getConnection();
	const result = await connection.query(`SELECT * FROM installation where team_id = $1`, [teamId]);
	if (result.rows.length === 1) {
		return result.rows[0];
	}
	return null;
}

export async function create(teamId: string, installation: Installation, installedBy: string): Promise<IInstallation> {
	const connection = await getConnection();
	const result = await connection.query(
		`INSERT INTO installation (team_id, installation, created_by, updated_by)        VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
		[teamId, JSON.stringify(installation), installedBy ?? 'anon@install', installedBy ?? 'anon@install'],
	);
	return result.rows[0];
}

export async function deleteOne(teamId: string): Promise<void> {
	const connection = await getConnection();
	await connection.query(`DELETE FROM installation WHERE team_id = $1`, [teamId]);
}
