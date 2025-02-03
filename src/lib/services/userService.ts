import { IUser } from '@/entities/user';
import { getConnection } from './database';
import * as installService from './installService';
import { app } from '@/app';

export async function getAllUsersByTeam(teamId: string): Promise<IUser[]> {
	const connection = await getConnection(teamId);
	const result = await connection.query(`SELECT * FROM users`);
	return result.rows;
}

export async function findOneBySlackIdOrCreate(teamId: string, slackId: string): Promise<IUser> {
	const connection = await getConnection(teamId);
	const result = await connection.query(`SELECT * FROM users WHERE slack_id = $1`, [slackId]);
	if (result.rows.length === 1) {
		return result.rows[0];
	}

	const teamInstall = await installService.findOne(teamId);
	if (!teamInstall?.installation.bot?.token) {
		throw new Error('Installation not found');
	}
	// We will need to store and get the token for the client's specific team api
	const response = await app.client.users.info({
		token: (teamInstall.installation.bot ?? teamInstall.installation.user).token,
		user: slackId,
	});
	const createdUser = await connection.query(
		`INSERT INTO users (slack_id, score, reasons, points_given, robot_day, account_level, total_points_given, email, name, is_admin, is_bot, updated_by, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
		[
			slackId,
			0,
			{},
			{},
			new Date(),
			1,
			0,
			response.user?.profile?.email ?? `unknownEmail@${teamId}.com`,
			response.user?.name ?? `unknownUser@${teamId}`,
			response.user?.is_admin ?? false,
			response.user?.is_bot ?? true,
			slackId,
			new Date(),
		],
	);
	return createdUser.rows[0];
}
