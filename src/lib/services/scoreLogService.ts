import { type IScoreLog } from '@/entities/scoreLog';
import { getConnection } from '@/lib/services/databaseService';

export async function create(teamId: string, scoreLog: IScoreLog): Promise<IScoreLog> {
	const connection = await getConnection(teamId);
	const result = await connection.query<IScoreLog>(
		`
    INSERT INTO
			score_log
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
		[scoreLog.from, scoreLog.to, scoreLog.date, scoreLog.channelId, scoreLog.reason, scoreLog.scoreChange],
	);
	return result.rows[0];
}
