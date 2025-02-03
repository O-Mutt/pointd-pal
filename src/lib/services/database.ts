import { IUser } from '@/entities/user';
import { config } from '@config';

import { Client, Connection } from 'pg';

const rootDb = new Client({
	host: config.get('postgres.host'),
	user: config.get('postgres.username'),
	database: config.get('postgres.database'),
	keepAlive: true,
	idleTimeoutMillis: 30000,
	connectionTimeoutMillis: 2000,
});

const connections: { [key: string]: Connection } = {};
export async function getConnection(teamId?: string) {
	if (!teamId) {
		return (connections['root'] = connections['root'] || (await rootDb.connect()));
	} else if (!connections[teamId]) {
		const teamConnection = new Client({
			host: config.get('postgres.host'),
			user: config.get('postgres.username'),
			database: teamId,
			keepAlive: true,
			idleTimeoutMillis: 30000,
			connectionTimeoutMillis: 2000,
		});
		connections[teamId] = await teamConnection.connect();
	}
	return connections[teamId];
}

export async function isSpam(teamId: string, to: IUser, from: IUser) {
	//Logger.debug('spam check');
	const now = moment();
	const fiveMinutesAgo = now.subtract(this.spamTimeLimit, 'minutes').toDate();
	// There is 1+ and that means we have spam
	const isSpam =
		(await ScoreLog(connectionFactory(teamId))
			.countDocuments({ to: to.slackId, from: from.slackId, date: { $gte: fiveMinutesAgo } })
			.exec()) !== 0;
	//Logger.debug('spam check result', previousScoreExists);
	return isSpam;
}

export async function updateAccountLevelToTwo(user: IUser): Promise<void> {
	user.pointdPalToken = user.score;
	user.accountLevel = 2;
	await user.save();
	await BotToken.findOneAndUpdate({}, { $inc: { pointdPalToken: -user.pointdPalToken } }).exec();
	eventBus.emit('plusplus-tokens');
	return;
}

/**
 *
 * @param {object} user the user receiving the points
 * @param {object} from the user sending the points
 * @param {number} scoreChange the increment in which the user is getting/losing points
 * @returns {object} the user who received the points updated value
 */
export async function transferTokens(teamId: string, user: IUser, from: IUser, scoreChange: number): Promise<void> {
	user.pointdPalToken = user.pointdPalToken || 0 + scoreChange;
	from.pointdPalToken = from.pointdPalToken || 0 - scoreChange;
	await user.save();
	await from.save();
}

export async function getMagicSecretStringNumberValue() {
	const updateBotWallet = await BotToken.findOne({ name: 'pointdPal' });
	if (updateBotWallet) {
		return updateBotWallet.magicString;
	}
	return '';
}
