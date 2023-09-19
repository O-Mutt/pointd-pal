import { ESMap } from 'typescript';

import { app } from '../../app';
import { APointdPalEntity } from './APointdPalEntity';
import { Sql } from 'postgres';
import { Installation } from './installations';

export class User extends APointdPalEntity {
  slackId: string;
  score: number;
  pointdPalDay: Date;
  accountLevel: number;
  totalPointsGiven: number;
  isAdmin: boolean;
  isBot: boolean;
  pointdPalToken: number;
  email?: string;
  name?: string;
  walletAddress?: string;
  getCreateTableQuery(): string[] {
    return [
      `
        CREATE TABLE IF NOT EXISTS user
          slackId TEXT NOT NULL,
          score INTEGER NOT NULL default 0,
          pointdPalDay TIMESTAMP NOT NULL DEFAULT NOW(),
          accountLevel INTEGER NOT NULL default 1,
          totalPointsGiven INTEGER NOT NULL default 0,
          isAdmin BOOLEAN NOT NULL default false,
          isBot BOOLEAN NOT NULL default false,
          pointdPalToken INTEGER NOT NULL default 0,
          email TEXT,
          name TEXT,
          walletAddress TEXT,
          ${this.auditTableCreatePartial}
      `,
      `
        CREATE INDEX IF NOT EXISTS userId_idx
          ON user (id);
        CREATE INDEX IF NOT EXISTS user_slackId_idx
          ON user (slackId);
        CREATE INDEX IF NOT EXISTS user_email_idx
          ON user (email);
      `,
      new UserReasons().getCreateTableQuery(),
      new UserPointsGiven().getCreateTableQuery(),
    ];
  }

  static async findOneBySlackIdOrCreate(sql: Sql, slackId: string) {
    const [user] = await sql<User[]>`
    SELECT * from user WHERE slackId = ${slackId} ORDER BY score DESC LIMIT 1;
    `;
    if (user) {
      return user;
    }

    const teamInstall = await Installation.findInstallationByTeamId(sql, slackId);
    if (!teamInstall?.installation.bot?.token) {
      throw new Error('Installation not found');
    }

    const { user: slackUser } = await app.client.users.info({
      token: teamInstall.installation.bot.token,
      user: slackId,
    });
    if (!slackUser) {
      throw new Error('User not found');
    }

    const [newUser] = await sql`
      INSERT INTO user (slackId, email, name, isAdmin, isBot, updatedBy)
      VALUES (
        ${slackId},
        ${slackUser.profile?.email ?? 'email@missing.com'},
        ${slackUser.name ?? 'Missing Name'},
        ${slackUser.is_admin ?? false},
        ${slackUser.is_bot ?? false},
        ${slackId})
      RETURNING *
    `;
    return newUser;
  }
}

export class UserReasons {
  getCreateTableQuery(): string {
    return `
        CREATE TABLE IF NOT EXISTS user_reasons
          user_id TEXT NOT NULL,
          score INTEGER NOT NULL default 0,
          reason TEXT NOT NULL,
      `;
  }
}

export class UserPointsGiven {
  getCreateTableQuery(): string {
    return `
        CREATE TABLE IF NOT EXISTS user_points_given
          sender_id TEXT NOT NULL,
          recipient TEXT NOT NULL
          number_of_points INTEGER NOT NULL default 0,
      `;
  }
}
