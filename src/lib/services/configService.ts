import { app } from '@/app';
import { IPointdPalConfig } from '@/entities/pointdPalConfig';
import { getConnection } from '@/lib/services/databaseService';
import * as installService from '@/lib/services/installService';

export async function findOneOrCreate(teamId: string): Promise<IPointdPalConfig> {
	const connection = await getConnection(teamId);
	let pointdPalConfig = await connection.query('SELECT * FROM configs;');
	if (pointdPalConfig) {
		return pointdPalConfig;
	}

	const teamInstall = await installService.findOne(teamId);
	if (!teamInstall?.installation.bot?.token) {
		throw new Error('Installation not found');
	}
	const { members } = await app.client.users.list({ token: teamInstall.installation.bot.token, team_id: teamId });
	const admins = members?.filter((user) => user.is_admin === true).map((admin) => admin.id);
	// this is not done
	await connection.query('INSERT INTO admins ');
	return await connection.query('INSERT INTO configs');
}
