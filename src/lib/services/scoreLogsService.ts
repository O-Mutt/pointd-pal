import { type IScoreLog } from '@/models';
import { databaseService } from '@/lib/services';

export class ScoreLogsService {
	async create(teamId: string, scoreLog: IScoreLog): Promise<IScoreLog> {
		const connection = await databaseService.getConnection(teamId);
		const result = await connection.query<IScoreLog>(
			`
    INSERT INTO
			score_logs
			(
				"from",
				"to",
				"date",
				channel_id,
				reason,
				score_change
			)
    VALUES
			($1, $2, $3, $4, $5, $6)
    RETURNING
			"from",
			"to",
			"date",
			channel_id as "channelId",
			reason,
			score_change as "scoreChange";
  `,
			[scoreLog.from, scoreLog.to, 'now()', scoreLog.channelId, scoreLog.reason, scoreLog.scoreChange],
		);
		return result.rows[0];
	}
}

export const scoreLogsService = new ScoreLogsService();
