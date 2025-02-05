import { IBotToken } from '@/entities/botToken';
import { getConnection } from './databaseService';

export async function create(botToken: IBotToken): Promise<IBotToken> {
	const { enabled, name, publicWalletAddress, token, magicString } = botToken;
	const connection = await getConnection();
	const result = await connection.query<IBotToken>(
		`INSERT INTO bot_tokens (enabled, name, public_wallet_address, token, magic_string)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
		[enabled, name, publicWalletAddress, token, magicString],
	);
	return result.rows[0];
}

export async function find(id?: number): Promise<IBotToken> {
	const connection = await getConnection();

	if (!id) {
		const result = await connection.query<IBotToken>(`SELECT * FROM bot_tokens`);
		return result.rows[0];
	}
	const result = await connection.query<IBotToken>(`SELECT * FROM bot_tokens WHERE id = $1`, [id]);
	return result.rows[0];
}

export async function update(id: number, botToken: Partial<IBotToken>): Promise<IBotToken> {
	const connection = await getConnection();

	const fields = Object.keys(botToken)
		.map((key, index) => `${key} = $${index + 2}`)
		.join(', ');
	const values = Object.values(botToken);
	const result = await connection.query<IBotToken>(`UPDATE bot_tokens SET ${fields} WHERE id = $1 RETURNING *`, [
		id,
		...values,
	]);
	return result.rows[0];
}

export async function deleteToken(id: number): Promise<void> {
	const connection = await getConnection();

	await connection.query(`DELETE FROM bot_tokens WHERE id = $1`, [id]);
}

export async function getMagicSecretStringNumberValue(): Promise<string> {
	const connection = await getConnection();
	const result = await connection.query<IBotToken>(`SELECT magic_string FROM bot_tokens WHERE name = 'pointdPal'`);
	return result.rows[0]?.magicString ?? '';
}

export async function subtractTokens(token: number): Promise<void> {
	const connection = await getConnection();
	await connection.query<IBotToken>(`UPDATE bot_tokens SET token = token - $1 WHERE name = 'pointdPal'`, [token]);
	return;
}
