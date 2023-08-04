import { Schema, Document, Model, Connection } from 'mongoose';
import { app } from '../../../app';
import { AuditTags } from './auditTags';
import { Installation } from './installation';

export interface IPointdPalConfig extends Document, AuditTags {
  notificationRoom?: string;
  falsePositiveRoom?: string;
  scoreboardRoom?: string;
  formalFeedbackUrl?: string;
  formalFeedbackModulo: number;
  reasonsKeyword?: string;
  companyName?: string;
  pointdPalAdmins?: string[];
  tokenLedgerBalance: number;
}

export const PointdPalConfigSchema = new Schema({
  notificationRoom: String,
  falsePositiveRoom: String,
  scoreboardRoom: String,
  formalFeedbackUrl: String,
  formalFeedbackModulo: {
    type: Number,
    default: 10,
  },
  companyName: String,
  pointdPalAdmins: [String],
  tokenLedgerBalance: Number,
});

PointdPalConfigSchema.statics.findOneOrCreate = async function (
  this: Model<PointdPalConfigInterface, PointdPalConfigModelInterface>,
  teamId: string,
): Promise<IPointdPalConfig> {
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

export interface PointdPalConfigInterface extends IPointdPalConfig {
  // instance methods
}

export interface PointdPalConfigModelInterface extends Model<PointdPalConfigInterface> {
  // static methods
  findOneOrCreate(teamId: string): Promise<IPointdPalConfig>;
}

export const PointdPalConfig = (conn: Connection) =>
  conn.model<PointdPalConfigInterface, PointdPalConfigModelInterface>('pointdPalConfig', PointdPalConfigSchema);
