import type { IUser, IScoreLog } from '@/models';
import { withNamespace } from '@/logger';
import { databaseService } from '@/lib/services';

const logger = withNamespace('scoreboardService');

export class ScoreboardService {
	constructor(private logger = withNamespace('scoreboardService')) {}

	async getTopScores(teamId: string, amount: number) {
		this.logger.info('Finding top scores', teamId, amount);
		const connection = await databaseService.getConnection(teamId);
		const result = await connection.query<Pick<IUser, 'id' | 'score' | 'token' | 'slackId' | 'accountLevel'>>(
			`
    SELECT id, score, token, slack_id, account_level
      FROM users
      ORDER BY
        score DESC
        account_level DESC
        LIMIT $1`,
			[amount],
		);

		logger.debug('Trying to find top scores');

		return result.rows;
	}

	async getBottomScores(teamId: string, amount: number) {
		this.logger.info('Finding bottom scores', teamId, amount);
		const connection = await databaseService.getConnection(teamId);
		const result = await connection.query<Pick<IUser, 'id' | 'score' | 'token' | 'slackId' | 'accountLevel'>>(
			`
    SELECT id, score, token, slack_id, account_level
      FROM users
      ORDER BY
        score ASC
        account_level DESC
        LIMIT $1`,
			[amount],
		);

		logger.debug('Trying to find bottom ${amount} scores');

		return result.rows;
	}

	async getTopTokens(teamId: string, amount: number) {
		this.logger.info('Finding top tokens', teamId, amount);
		const connection = await databaseService.getConnection(teamId);
		const result = await connection.query<Pick<IUser, 'id' | 'score' | 'token' | 'slackId' | 'accountLevel'>>(
			`
    SELECT id, score, token, slack_id, account_level
      FROM users
      WHERE account_level >= 2
      ORDER BY
        token DESC
        score DESC
        LIMIT $1`,
			[amount],
		);

		logger.debug('Trying to find top ${amount} tokens');

		return result.rows;
	}

	async getBottomTokens(teamId: string, amount: number) {
		this.logger.info('Finding bottom tokens', teamId, amount);
		const connection = await databaseService.getConnection(teamId);
		const result = await connection.query<Pick<IUser, 'id' | 'score' | 'token' | 'slackId' | 'accountLevel'>>(
			`
    SELECT id, score, token, slack_id, account_level
      FROM users
      WHERE account_level >= 2
      ORDER BY
        token ASC
        score ASC
        LIMIT $1`,
			[amount],
		);

		logger.debug('Trying to find top ${amount} tokens');

		return result.rows;
	}

	async getTopSender(teamId: string, amount: number) {
		this.logger.info('Finding top senders', teamId, amount);
		const connection = await databaseService.getConnection(teamId);
		const result = await connection.query<Pick<IUser, 'id' | 'totalPointsGiven' | 'slackId'>>(
			`
    SELECT id, slack_id, total_points_given
      FROM users
      ORDER BY
        total_points_given DESC
        account_level DESC
        LIMIT $1`,
			[amount],
		);

		logger.debug('Trying to find top scores');

		return result.rows;
	}

	async getBottomSender(teamId: string, amount: number) {
		this.logger.info('Finding bottom senders', teamId, amount);
		const connection = await databaseService.getConnection(teamId);
		const result = await connection.query<Pick<IUser, 'id' | 'totalPointsGiven' | 'slackId'>>(
			`
    SELECT slack_id, total_points_given
      FROM users
      ORDER BY
        total_points_given ASC
        account_level DESC
        LIMIT $1`,
			[amount],
		);

		logger.debug('Trying to find top scores');

		return result.rows;
	}

	async getTopSenderInDuration(teamId: string, amount = 10, days = 7) {
		this.logger.info('Finding top senders in duration', teamId, amount, days);
		const connection = await databaseService.getConnection(teamId);
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

		logger.debug('Trying to find top scores');

		return result.rows;
	}

	async getTopReceiverInDuration(teamId: string, amount = 10, days = 7) {
		this.logger.info('Finding top receivers in duration', teamId, amount, days);
		const connection = await databaseService.getConnection(teamId);
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

		logger.debug('Trying to find top scores');

		return result.rows;
	}

	async getTopRoomInDuration(teamId: string, amount = 3, days = 7) {
		this.logger.info('Finding top room in duration', teamId, amount, days);

		const connection = await databaseService.getConnection(teamId);
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
}

export const scoreboardService = new ScoreboardService();
