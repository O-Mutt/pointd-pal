import { getConnection } from './databaseService';

export async function getTopScores(teamId: string, amount: number) {
	const connection = await getConnection(teamId);
	const result = await connection.query(
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
	const result = await connection.query(
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
	const result = await connection.query(
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
	const result = await connection.query(
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
	const result = await connection.query(
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
	const result = await connection.query(
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

export async function getTopSenderInDuration(teamId: string, amount: number = 10, days: number = 7) {
	const connection = await getConnection(teamId);
	const result = await connection.query(
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

export async function getTopReceiverInDuration(teamId: string, amount: number = 10, days: number = 7) {
	const connection = await getConnection(teamId);
	const result = await connection.query(
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

export async function getTopRoomInDuration(teamId: string, amount: number = 3, days: number = 7) {
	const connection = await getConnection(teamId);
	const result = await connection.query(
		`
    SELECT channel, sum(score_change) as total_points_given
      FROM score_logs
      WHERE
        date > NOW() - INTERVAL '$1 days'
      GROUP BY
        channel
      ORDER BY
        total_points_given desc
        LIMIT $2`,
		[days, amount],
	);
	return result.rows;
}
