import { APointdPalEntity } from './APointdPalEntity';

export class BotToken extends APointdPalEntity {
  enabled: boolean;
  name: string;
  publicWalletAddress: string;
  token: number;
  magicString: string;
  getCreateTableQuery(): string[] {
    return [
      `
        CREATE TABLE IF NOT EXISTS bot_token (
          enabled BOOLEAN NOT NULL DEFAULT true,
          name TEXT NOT NULL,
          publicWalletAddress TEXT NOT NULL,
          token INTEGER NOT NULL,
          magicString TEXT NOT NULL,
          ${this.auditTableCreatePartial}
        )
      `,
      `
      CREATE INDEX IF NOT EXISTS botToken_id_idx
          ON bot_token (id);
      CREATE INDEX IF NOT EXISTS botToken_name_idx
        ON bot_token (name);

      `,
    ];
  }
}
