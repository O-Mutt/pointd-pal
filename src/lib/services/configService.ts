import { app } from '@/app';
import { IPointdPalConfig } from '@/entities/pointdPalConfig';
import { getConnection } from '@/lib/services/databaseService';
import * as installService from '@/lib/services/installService';

export async function findOneOrCreate(teamId: string): Promise<IPointdPalConfig> {
	const connection = await getConnection(teamId);
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
	result = await connection.query<IPointdPalConfig>('INSERT INTO configs (team_id) VALUES ($1) RETURNING *', [teamId]);
	return result.rows[0];
}

export async function update(teamId: string, config: IPointdPalConfig): Promise<IPointdPalConfig | null> {
	const connection = await getConnection(teamId);
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
