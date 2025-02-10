import { type IBotToken } from '@/models/botToken';
import { databaseService } from '@/lib/services';
import { withNamespace } from '@/logger';

export class BotTokenService {
	constructor(private logger = withNamespace('botTokenService')) {}

	async create(botToken: IBotToken): Promise<IBotToken> {
		this.logger.info('Creating bot token');
		const { enabled, name, publicWalletAddress, token, magicString } = botToken;
		const connection = await databaseService.getConnection();
		const result = await connection.query<IBotToken>(
			`
				INSERT INTO bot_tokens
					(enabled, name, public_wallet_address, token, magic_string)
				VALUES
					($1, $2, $3, $4, $5)
				RETURNING *
			`,
			[enabled, name, publicWalletAddress, token, magicString],
		);
		return result.rows[0];
	}

	async find(id?: number): Promise<IBotToken> {
		this.logger.info('Find bot token');
		const connection = await databaseService.getConnection();

		if (!id) {
			const result = await connection.query<IBotToken>(
				`
				SELECT * FROM bot_tokens
				`,
			);
			return result.rows[0];
		}
		const result = await connection.query<IBotToken>(
			`
			SELECT *
			FROM bot_tokens
			WHERE id = $1`,
			[id],
		);
		return result.rows[0];
	}

	async update(id: number, botToken: Partial<IBotToken>): Promise<IBotToken> {
		this.logger.info('Update bot token');
		const connection = await databaseService.getConnection();

		const fields = Object.keys(botToken)
			.map((key, index) => `${key} = $${index + 2}`)
			.join(', ');
		const values = Object.values(botToken);
		const result = await connection.query<IBotToken>(
			`
			UPDATE bot_tokens
			SET ${fields}
			WHERE id = $1
			RETURNING *`,
			[id, ...values],
		);
		return result.rows[0];
	}

	async deleteToken(id: number): Promise<void> {
		this.logger.info('Delete bot token');

		const connection = await databaseService.getConnection();

		await connection.query(`DELETE FROM bot_tokens WHERE id = $1`, [id]);
	}

	async getMagicSecretStringNumberValue(): Promise<string> {
		const connection = await databaseService.getConnection();
		const result = await connection.query<IBotToken>(
			`
				SELECT magic_string as "magicString"
				FROM bot_tokens
				WHERE name = 'pointdPal'
			`,
		);
		return result.rows[0]?.magicString ?? '';
	}

	async subtractTokens(token: number): Promise<void> {
		const connection = await databaseService.getConnection();
		await connection.query<IBotToken>(
			`
			UPDATE bot_tokens
			SET token = token - $1
			WHERE name = 'pointdPal'
			`,
			[token],
		);
		return;
	}
}

export const botTokenService = new BotTokenService();
