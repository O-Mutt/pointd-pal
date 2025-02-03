import { IBotToken } from '@/entities/botToken';
import { getConnection } from './database';

export async function create(botToken: IBotToken): Promise<IBotToken> {
	const { enabled, name, publicWalletAddress, token, magicString } = botToken;
	const connection = await getConnection();
	const result = await connection.query(
		`INSERT INTO bot_tokens (enabled, name, public_wallet_address, token, magic_string)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
		[enabled, name, publicWalletAddress, token, magicString],
	);
	return result.rows[0];
}

export async function findById(id?: number): Promise<IBotToken | null> {
	const connection = await getConnection();

	if (!id) {
		const result = await connection.query(`SELECT * FROM bot_tokens`);
		return result.rows[0] ?? null;
	}
	const result = await connection.query(`SELECT * FROM bot_tokens WHERE id = $1`, [id]);
	return result.rows[0] ?? null;
}

export async function update(id: number, botToken: Partial<IBotToken>): Promise<IBotToken | null> {
	const connection = await getConnection();

	const fields = Object.keys(botToken)
		.map((key, index) => `${key} = $${index + 2}`)
		.join(', ');
	const values = Object.values(botToken);
	const result = await connection.query(`UPDATE bot_tokens SET ${fields} WHERE id = $1 RETURNING *`, [id, ...values]);
	return result.rows[0] || null;
}

export async function deleteToken(id: number): Promise<void> {
	const connection = await getConnection();

	await connection.query(`DELETE FROM bot_tokens WHERE id = $1`, [id]);
}
