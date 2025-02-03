import { IScoreLog } from '@/entities/scoreLog';
import { getConnection } from '@/lib/services/databaseService';

export async function create(teamId: string, scoreLog: IScoreLog): Promise<IScoreLog> {
	const connection = await getConnection(teamId);
	return connection.query(
		`
    INSERT INTO score_log (from, to, date, channel, reason, score_change)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `,
		[scoreLog.from, scoreLog.to, scoreLog.date, scoreLog.channel, scoreLog.reason, scoreLog.scoreChange],
	);
}
