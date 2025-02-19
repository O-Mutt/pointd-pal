import { type IPointdPalConfig } from '@/models/pointdPalConfig';
import { databaseService, installService } from '@/lib/services';
import { withNamespace } from '@/logger';
import { config as appConfig } from '@/config';

export class ConfigService {
	constructor(
		private logger = withNamespace('configService'),
		private config = appConfig,
	) {}

	async getOrCreate(teamId: string): Promise<IPointdPalConfig> {
		this.logger.info('Finding or creating config');
		const connection = await databaseService.getConnection(teamId);
		let result = await connection.query<IPointdPalConfig>(`SELECT ${this.getAliasedFields()} FROM configs;`);
		if (result?.rows[0]) {
			return result.rows[0];
		}

		const teamInstall = await installService.findOne(teamId);
		if (!teamInstall?.installation.bot?.token) {
			throw new Error('Installation not found');
		}
		// const { members } = await app.client.users.list({ token: teamInstall.installation.bot.token, team_id: teamId });
		// const admins = members?.filter((user) => user.is_admin === true).map((admin) => admin.id);

		// this is not done
		// await connection.query('INSERT INTO admins ');
		result = await connection.query<IPointdPalConfig>(
			`
			INSERT INTO configs
			(
				scoreboard_channel,
				scoreboard_cron,
				formal_feedback_modulo,
				notification_channel
			)
			VALUES
			(
				$1,
				$2,
				$3,
				$4
			)
			RETURNING *
			`,
			[
				this.config.get('scoreboard.channel'),
				this.config.get('scoreboard.cron'),
				this.config.get('formalFeedbackModulo'),
				this.config.get('notificationsChannel'),
			],
		);

		return result.rows[0];
	}

	async update(teamId: string, config: IPointdPalConfig): Promise<IPointdPalConfig | null> {
		this.logger.info('Updating config');
		const connection = await databaseService.getConnection(teamId);
		const fields = config.getCamelToSnakeFields();
		const values = Object.values(config);
		const result = await connection.query<IPointdPalConfig>(
			`
			UPDATE configs
				SET ${fields}
				WHERE id = $1
				RETURNING ${this.getAliasedFields()}`,
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			[config.id, ...values],
		);
		return result.rows[0];
	}

	private getAliasedFields(): string {
		return `
		id,
		company_name as "companyName",
		is_april_fools_day_enabled as "isAprilFoolsDayEnabled",
		false_positive_channel as "falsePositiveChannel",
		formal_feedback_modulo as "formalFeedbackModulo",
		formal_feedback_url as "formalFeedbackUrl",
		scoreboard_cron as "scoreboardCron",
		scoreboard_channel as "scoreboardChannel",
		token_ledger_balance as "tokenLedgerBalance",
		created_at as "createdAt",
		updated_at as "updatedAt"`;
	}
}

export const configService = new ConfigService();
