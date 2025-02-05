import { IScoreLog } from '@/entities/scoreLog';
import { getConnection } from './databaseService';
import { IUser } from '@/entities/user';

export async function getTopScores(teamId: string, amount: number) {
	const connection = await getConnection(teamId);
	const result = await connection.query<Pick<IUser, 'score'>>(
		`
    SELECT score
      FROM users
      ORDER BY
        score DESC
        account_level DESC
        LIMIT $1`,
		[amount],
	);

	//Logger.debug('Trying to find top scores');

	return result.rows;
}

export async function getBottomScores(teamId: string, amount: number) {
	const connection = await getConnection(teamId);
	const result = await connection.query<Pick<IUser, 'score'>>(
		`
    SELECT score
      FROM users
      ORDER BY
        score ASC
        account_level DESC
        LIMIT $1`,
		[amount],
	);

	//Logger.debug('Trying to find bottom ${amount} scores');

	return result.rows;
}

export async function getTopTokens(teamId: string, amount: number) {
	const connection = await getConnection(teamId);
	const result = await connection.query<Pick<IUser, 'score'>>(
		`
    SELECT score
      FROM users
      WHERE account_level >= 2
      ORDER BY
        token DESC
        score DESC
        LIMIT $1`,
		[amount],
	);

	//Logger.debug('Trying to find top ${amount} tokens');

	return result.rows;
}

export async function getBottomTokens(teamId: string, amount: number) {
	const connection = await getConnection(teamId);
	const result = await connection.query<Pick<IUser, 'score'>>(
		`
    SELECT score
      FROM users
      WHERE account_level >= 2
      ORDER BY
        token ASC
        score ASC
        LIMIT $1`,
		[amount],
	);

	//Logger.debug('Trying to find top ${amount} tokens');

	return result.rows;
}

export async function getTopSender(teamId: string, amount: number) {
	const connection = await getConnection(teamId);
	const result = await connection.query<Pick<IUser, 'totalPointsGiven'>>(
		`
    SELECT total_points_given
      FROM users
      ORDER BY
        total_points_given DESC
        account_level DESC
        LIMIT $1`,
		[amount],
	);

	//Logger.debug('Trying to find top scores');

	return result.rows;
}

export async function getBottomSender(teamId: string, amount: number) {
	const connection = await getConnection(teamId);
	const result = await connection.query<Pick<IUser, 'totalPointsGiven'>>(
		`
    SELECT total_points_given
      FROM users
      ORDER BY
        total_points_given ASC
        account_level DESC
        LIMIT $1`,
		[amount],
	);

	//Logger.debug('Trying to find top scores');

	return result.rows;
}

export async function getTopSenderInDuration(teamId: string, amount = 10, days = 7) {
	const connection = await getConnection(teamId);
	const result = await connection.query<Pick<IScoreLog, 'from'> & { sumOfScoreChange: number }>(
		`
    SELECT from, sum(score_change) as total_points_given
      FROM score_logs
      WHERE
        date > NOW() - INTERVAL '$1 days'
      GROUP BY
        from
      ORDER BY
        total_points_given desc
        LIMIT $2`,
		[days, amount],
	);

	//Logger.debug('Trying to find top scores');

	return result.rows;
}

export async function getTopReceiverInDuration(teamId: string, amount = 10, days = 7) {
	const connection = await getConnection(teamId);
	const result = await connection.query<Pick<IScoreLog, 'to'> & { sumOfScoreChange: number }>(
		`
    SELECT to, sum(score_change) as total_points_given
      FROM score_logs
      WHERE
        date > NOW() - INTERVAL '$1 days'
      GROUP BY
        to
      ORDER BY
        total_points_given desc
        LIMIT $2`,
		[days, amount],
	);

	//Logger.debug('Trying to find top scores');

	return result.rows;
}

export async function getTopRoomInDuration(teamId: string, amount = 3, days = 7) {
	const connection = await getConnection(teamId);
	const result = await connection.query<Pick<IScoreLog, 'channelId' | 'channelName'> & { sumOfScoreChange: number }>(
		`
    SELECT channel_id, channel_name, sum(score_change) as total_points_given
      FROM score_logs
      WHERE
        date > NOW() - INTERVAL '$1 days'
      GROUP BY
        channel_id
      ORDER BY
        total_points_given desc
        LIMIT $2`,
		[days, amount],
	);
	return result.rows;
}
