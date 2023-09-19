import { app } from '../../app';
import { APointdPalEntity } from './APointdPalEntity';
import { Installation, Installations } from './installations';
import { Sql } from 'postgres';

export class PointdInstanceConfig extends APointdPalEntity {
  getCreateTableQuery(): string[] {
    return [
      `
        CREATE TABLE IF NOT EXISTS pointd_instance_config (
          notification_room TEXT NOT NULL,
          false_positive_room TEXT NOT NULL,
          scoreboard_room TEXT NOT NULL,
          formal_feedback_url TEXT NOT NULL,
          formal_feedback_modulo INTEGER NOT NULL DEFAULT 10,
          reasons_keyword TEXT NOT NULL,
          company_name TEXT NOT NULL,
          pointd_pal_admins TEXT NOT NULL,
          token_ledger_balance INTEGER NOT NULL,

          ${this.auditTableCreatePartial}
        );
      `,
      `
        CREATE INDEX IF NOT EXISTS instanceId_idx
          on pointd_instance_config (id);
        CREATE INDEX IF NOT EXISTS teamId_idx
          ON pointd_instance_config (teamId);
      `,
    ];
  }

  async findOneOrCreate(sql: Sql, teamId: string) {
    const teamInstall = await Installation.findInstallationByTeamId(sql, teamId);
  }
}

PointdPalConfigSchema.statics.findOneOrCreate = async function (teamId: string): Promise<IPointdPalConfig> {
  const self = this;
  let pointdPalConfig = await self.findOne().exec();
  if (pointdPalConfig) {
    return pointdPalConfig;
  }

  const teamInstall = await Installation.findOne({ teamId: teamId }).exec();
  if (!teamInstall?.installation.bot?.token) {
    throw new Error('Installation not found');
  }
  const { members } = await app.client.users.list({ token: teamInstall.installation.bot.token, team_id: teamId });
  const admins = members?.filter((user) => user.is_admin === true).map((admin) => admin.id);
  pointdPalConfig = new self({
    pointdPalAdmins: admins,
  });
  return await self.create(pointdPalConfig);
};
