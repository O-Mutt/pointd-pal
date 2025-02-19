import { app } from '@/app';
import type { IUser } from '@/models/user';

import { installService, databaseService } from '@/lib/services';
import type { Member } from '@slack/web-api/dist/types/response/UsersListResponse';

export class UserService {
	/**
	 * Get all users in a team
	 * @param teamId
	 */
	async getTeamId(teamId: string): Promise<IUser[]> {
		const connection = await databaseService.getConnection(teamId);
		const result = await connection.query<IUser>(`SELECT ${this.getAliasedFieldsAsCamelCase()} FROM users`);
		return result.rows;
	}

	async getOrCreateBySlackId(teamId: string, slackId: string): Promise<IUser> {
		const connection = await databaseService.getConnection(teamId);
		const result = await connection.query<IUser>(
			`SELECT
			${this.getAliasedFieldsAsCamelCase()}
		 FROM users
		 WHERE slack_id = $1`,
			[slackId],
		);
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
		const createdUser = await connection.query<IUser>(
			`INSERT INTO users
			(
				slack_id,
				email,
				name,
				is_admin,
				is_bot,
				updated_by)
			VALUES
				(
					$1,
					$2,
					$3,
					$4,
					$5,
					$6)
		RETURNING ${this.getAliasedFieldsAsCamelCase()}`,
			[
				slackId,
				response.user?.profile?.email ?? `unknownEmail@${teamId}.com`,
				response.user?.name ?? `unknownUser@${teamId}`,
				response.user?.is_admin ?? false,
				response.user?.is_bot ?? false,
				slackId,
			],
		);
		return createdUser.rows[0];
	}

	async setUserAsAdmin(teamId: string, slackId: string): Promise<IUser> {
		const connection = await databaseService.getConnection(teamId);
		const result = await connection.query<IUser>(
			`UPDATE users SET is_admin = true WHERE slack_id = $1 RETURNING ${this.getAliasedFieldsAsCamelCase()}`,
			[slackId],
		);
		return result.rows[0];
	}

	async update(teamId: string, user: IUser) {
		const connection = await databaseService.getConnection(teamId);
		const snakeFields = Object.keys(user)
			// this could break if the key has something like isURL
			.map((key, index) => `${key.camelToSnakeCase()} = $${index + 2}`)
			.join(', ');
		const values = Object.values(user);
		const result = await connection.query<IUser>(
			`
		UPDATE users
			SET ${snakeFields}
			WHERE id = $1
			RETURNING ${this.getAliasedFieldsAsCamelCase()}`,
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			[user.id, ...values],
		);
		return result.rows[0];
	}

	async upsert(teamId: string, users: Member[]) {
		const connection = await databaseService.getConnection(teamId);

		// lookup all the users by users.id, if it doesn't exist, insert it
		const result = await connection.query<IUser>(
			`
			SELECT
				id,
				slack_id as "slackId"
			FROM users
			WHERE slack_id = ANY($1)`,
			[users.map((user) => user.id)],
		);

		const existingUsers = result.rows;
		const existingUserIds = existingUsers.map((user) => user.slackId);
		const newUsers = users.filter((user) => !existingUserIds.includes(user.id!));

		const newUsersResult = await connection.query<IUser>(
			`
			INSERT INTO users
				(
					slack_id,
					email,
					name,
					is_admin,
					is_bot,
					updated_by)
			VALUES
				(
					$1,
					$2,
					$3,
					$4,
					$5,
					$6)
			RETURNING ${this.getAliasedFieldsAsCamelCase()}`,
			newUsers.flatMap((user: Member) => [
				user.id,
				user.profile?.email ?? `unknownEmail@${teamId}.com`,
				user.name ?? `unknownUser@${teamId}`,
				user.is_admin ?? false,
				user.is_bot ?? false,
				user.id,
			]),
		);

		return [...existingUsers, ...newUsersResult.rows];
	}

	async getByPredicate(teamId: string, predicate: string): Promise<IUser[]> {
		const connection = await databaseService.getConnection(teamId);
		const result = await connection.query<IUser>(`
		SELECT
			${this.getAliasedFieldsAsCamelCase()}
		FROM users
		WHERE ${predicate}`);
		return result.rows;
	}

	private getAliasedFieldsAsCamelCase() {
		return `id,
			slack_id as "slackId",
			score,
			reasons,
			points_given as "pointsGiven",
			pointd_pal_day as "pointdPalDay",
			account_level as "accountLevel",
			total_points_given as "totalPointsGiven",
			is_admin as "isAdmin",
			is_bot as "isBot",
			email,
			"name",
			wallet_address as "walletAddress",
			updated_at as "updatedAt",
			updated_by as "updatedBy"`;
	}
}

export const userService = new UserService();
