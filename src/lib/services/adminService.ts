import type { IUser } from '@/models';
import { databaseService } from '@/lib/services';
import { withNamespace } from '@/logger';

export class AdminService {
	constructor(private logger = withNamespace('adminService')) {}

	async erase(teamId: string, toBeErased: IUser, reason?: string): Promise<void> {
		this.logger.info(`Erasing user ${toBeErased.slackId} from team ${teamId}`);
		const connection = await databaseService.getConnection(teamId);

		if (reason) {
			const reasons = await connection.query<IUser>(`SELECT reasons FROM users WHERE slackId = $1`, [
				toBeErased.slackId,
			]);
			const reasonScore = reasons.rows[0].reasons[reason];
			const filteredReasons = Object.fromEntries(Object.entries(reasons.rows[0].reasons).filter(([k]) => k !== reason));

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
}

export const adminService = new AdminService();
