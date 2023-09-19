import { Installation as OAuthInstallation } from '@slack/oauth';
import { APointdPalEntity } from './APointdPalEntity';
import { Sql } from 'postgres';

export class Installation extends APointdPalEntity {
  teamId: string;
  installation: OAuthInstallation;
  customerId: string;
  enabled: boolean;

  getCreateTableQuery(): string[] {
    return [
      `
      CREATE TABLE IF NOT EXISTS installations (
        teamId TEXT NOT NULL,
        installation JSONB NOT NULL,
        customerId TEXT NOT NULL,
        enabled BOOLEAN NOT NULL,
        ${this.auditTableCreatePartial}
      );
      `,
      `
      CREATE INDEX IF NOT EXISTS teamId_customerId_idx
        ON installations (teamId, customerId);
      CREATE INDEX IF NOT EXISTS teamId_idx
        ON installations (teamId);
      CREATE INDEX IF NOT EXISTS customerId_idx
        ON installations (customerId);
      `,
    ];
  }

  static async findInstallationByTeamId(sql: Sql, teamId: string): Promise<Installation> {
    const [install] = await sql<Installation[]>`
    SELECT * FROM installations WHERE team_id = ${teamId} LIMIT 1;
    `;
    return install;
  }
}
