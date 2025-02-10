import { app } from '@/app';
import { type IPointdPalConfig } from '@/models/pointdPalConfig';
import { databaseService, installService } from '@/lib/services';
import { withNamespace } from '@/logger';

export class ConfigService {
	constructor(private logger = withNamespace('configService')) {}

	async findOneOrCreate(teamId: string): Promise<IPointdPalConfig> {
		this.logger.info('Finding or creating config');
		const connection = await databaseService.getConnection(teamId);
		let result = await connection.query<IPointdPalConfig>('SELECT * FROM configs;');
		if (result?.rows[0]) {
			return result.rows[0];
		}

		const teamInstall = await installService.findOne(teamId);
		if (!teamInstall?.installation.bot?.token) {
			throw new Error('Installation not found');
		}
		const { members } = await app.client.users.list({ token: teamInstall.installation.bot.token, team_id: teamId });
		const _admins = members?.filter((user) => user.is_admin === true).map((admin) => admin.id);
		// this is not done
		// await connection.query('INSERT INTO admins ');
		result = await connection.query<IPointdPalConfig>('INSERT INTO configs DEFAULT VALUES RETURNING *', []);
		return result.rows[0];
	}

	async update(teamId: string, config: IPointdPalConfig): Promise<IPointdPalConfig | null> {
		this.logger.info('Updating config');
		const connection = await databaseService.getConnection(teamId);
		const fields = Object.keys(config)
			.map((key, index) => `${key} = $${index + 2}`)
			.join(', ');
		const values = Object.values(config);
		const result = await connection.query<IPointdPalConfig>(
			`
			UPDATE configs
				SET ${fields}
				WHERE id = $1
				RETURNING *`,
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			[config.id, ...values],
		);
		return result.rows[0];
	}
}

export const configService = new ConfigService();
