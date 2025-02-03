import { IUser } from '@/entities/user';
import { getConnection } from './database';

export async function erase(teamId: string, toBeErased: IUser, reason?: string): Promise<void> {
	const connection = await getConnection(teamId);

	if (reason) {
		const reasons = await connection.query(`SELECT reasons FROM users WHERE slackId = $1`, [toBeErased.slackId]);
		const reasonScore = reasons.rows[0].reasons[reason];
		const filteredReasons = reasons.rows[0].reasons.filter((k, v) => k !== reason);

		await connection.query(`UPDATE users SET reasons = $1, score = score - $2 WHERE id = $3`, [
			filteredReasons,
			reasonScore,
			toBeErased.id,
		]);
	} else {
		await connection.query(`DELETE FROM users WHERE slackId = $1`, [toBeErased.slackId]);
	}
	return;
}
