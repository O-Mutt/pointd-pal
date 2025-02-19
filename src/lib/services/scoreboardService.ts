import type { IUser, IScoreLog } from '@/models';
import { withNamespace } from '@/logger';
import { databaseService } from '@/lib/services';

export class ScoreboardService {
	constructor(private logger = withNamespace('scoreboardService')) {}

	async getTopScores(teamId: string, amount: number) {
		this.logger.info('Finding top scores', teamId, amount);
		const connection = await databaseService.getConnection(teamId);
		const result = await connection.query<Pick<IUser, 'id' | 'score' | 'token' | 'slackId' | 'accountLevel'>>(
			`
			SELECT
				id,
				name,
				score,
				token,
				slack_id as "slackId",
				account_level as "accountLevel"
			FROM users
			ORDER BY
				score DESC,
				"accountLevel" DESC
			LIMIT $1`,
			[amount],
		);

		this.logger.debug('Trying to find top scores');

		return result.rows;
	}

	async getBottomScores(teamId: string, amount: number) {
		this.logger.info('Finding bottom scores', teamId, amount);
		const connection = await databaseService.getConnection(teamId);
		const result = await connection.query<Pick<IUser, 'id' | 'score' | 'token' | 'slackId' | 'accountLevel'>>(
			`
			SELECT
					id,
					name,
					score,
					token,
					slack_id as "slackId",
					account_level as "accountLevel"
				FROM users
				ORDER BY
					score ASC,
					"accountLevel" DESC
					LIMIT $1`,
			[amount],
		);

		this.logger.debug('Trying to find bottom ${amount} scores');

		return result.rows;
	}

	async getTopTokens(teamId: string, amount: number) {
		this.logger.info('Finding top tokens', teamId, amount);
		const connection = await databaseService.getConnection(teamId);
		const result = await connection.query<Pick<IUser, 'id' | 'score' | 'token' | 'slackId' | 'accountLevel'>>(
			`
			SELECT
					id,
					name,
					score,
					token,
					slack_id as "slackId",
					account_level as "accountLevel"
				FROM users
				WHERE "accountLevel" >= 2
				ORDER BY
					token DESC,
					score DESC
				LIMIT $1`,
			[amount],
		);

		this.logger.debug('Trying to find top ${amount} tokens');

		return result.rows;
	}

	async getBottomTokens(teamId: string, amount: number) {
		this.logger.info('Finding bottom tokens', teamId, amount);
		const connection = await databaseService.getConnection(teamId);
		const result = await connection.query<Pick<IUser, 'id' | 'score' | 'token' | 'slackId' | 'accountLevel'>>(
			`
			SELECT
				id,
				name,
				score,
				token,
				slack_id as "slackId",
				account_level as "accountLevel"
			FROM users
			WHERE "accountLevel" >= 2
			ORDER BY
				token ASC,
				score ASC
			LIMIT $1`,
			[amount],
		);

		this.logger.debug('Trying to find top ${amount} tokens');

		return result.rows;
	}

	async getTopSender(teamId: string, amount: number) {
		this.logger.info('Finding top senders', teamId, amount);
		const connection = await databaseService.getConnection(teamId);
		const result = await connection.query<Pick<IUser, 'id' | 'totalPointsGiven' | 'slackId'>>(
			`
    	SELECT
				id,
				name,
				slack_id as "slackId",
				total_points_given as "totalPointsGiven"
      FROM users
      ORDER BY
        total_points_given DESC,
        account_level DESC
			LIMIT $1`,
			[amount],
		);

		this.logger.debug('Trying to find top scores');

		return result.rows;
	}

	async getBottomSender(teamId: string, amount: number) {
		this.logger.info('Finding bottom senders', teamId, amount);
		const connection = await databaseService.getConnection(teamId);
		const result = await connection.query<Pick<IUser, 'id' | 'totalPointsGiven' | 'slackId'>>(
			`
    	SELECT
				id,
				name,
				slack_id as "slackId",
				total_points_given as "totalPointsGiven"
      FROM users
      ORDER BY
        total_points_given ASC,
        account_level DESC
			LIMIT $1`,
			[amount],
		);

		this.logger.debug('Trying to find top scores');

		return result.rows;
	}

	async getTopSenderInDuration(teamId: string, amount = 10, days = 7) {
		this.logger.info('Finding top senders in duration', teamId, amount, days);
		const connection = await databaseService.getConnection(teamId);
		const result = await connection.query<Pick<IScoreLog, 'from'> & { sumOfScoreChange: number }>(
			`
    	SELECT
				"from",
				sum(score_change) as "sumOfScoreChange"
      FROM score_logs
      WHERE
        date > NOW() - INTERVAL '$1 days'
      GROUP BY
        "from"
      ORDER BY
        "sumOfScoreChange" DESC
			LIMIT $2`,
			[days, amount],
		);

		this.logger.debug('Trying to find top scores');

		return result.rows;
	}

	async getTopReceiverInDuration(teamId: string, amount = 10, days = 7) {
		this.logger.info('Finding top receivers in duration', teamId, amount, days);
		const connection = await databaseService.getConnection(teamId);
		const result = await connection.query<Pick<IScoreLog, 'to'> & { sumOfScoreChange: number }>(
			`
    	SELECT
				"to",
				sum(score_change) as "sumOfScoreChange"
      FROM score_logs
      WHERE
        date > NOW() - INTERVAL '$1 days'
      GROUP BY
        "to"
      ORDER BY
        "sumOfScoreChange" DESC
			LIMIT $2`,
			[days, amount],
		);

		this.logger.debug('Trying to find top scores');

		return result.rows;
	}

	async getTopRoomInDuration(teamId: string, amount = 3, days = 7) {
		this.logger.info('Finding top room in duration', teamId, amount, days);

		const connection = await databaseService.getConnection(teamId);
		const result = await connection.query<Pick<IScoreLog, 'channelId' | 'channelName'> & { sumOfScoreChange: number }>(
			`
    	SELECT
				channel_id as "channelId",
				channel_name as "channelName",
				sum(score_change) as "sumOfScoreChange"
      FROM score_logs
      WHERE
        date > NOW() - INTERVAL '$1 days'
      GROUP BY
        channel_id
      ORDER BY
        "sumOfScoreChange" DESC
			LIMIT $2`,
			[days, amount],
		);
		return result.rows;
	}
}

export const scoreboardService = new ScoreboardService();
