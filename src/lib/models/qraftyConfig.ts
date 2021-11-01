import { Schema, Document, Model, Connection } from 'mongoose';
import { app } from '../../../app';
import { AuditTags } from './auditTags';
import { BonuslyConfigSchema, IBonuslyConfig } from './bonuslyConfig';
import { IInstallation, Installation } from './installation';

export interface IQraftyConfig extends Document, AuditTags {
  notificationRoom?: string;
  falsePositiveRoom?: string;
  scoreboardRoom?: string;
  formalFeedbackUrl?: string;
  formalFeedbackModulo: number;
  reasonsKeyword?: string;
  companyName?: string;
  qryptoEnabled?: boolean;
  qraftyAdmins?: string[];
  bonuslyConfig?: IBonuslyConfig;
}

export const QraftyConfigSchema = new Schema({
  notificationRoom: String,
  falsePositiveRoom: String,
  scoreboardRoom: String,
  formalFeedbackUrl: String,
  formalFeedbackModulo: {
    type: Number,
    default: 10
  },
  companyName: String,
  qryptoEnabled: {
    type: Boolean,
    default: false
  },
  qraftyAdmins: [String],
  bonuslyConfig: BonuslyConfigSchema,
});

QraftyConfigSchema.statics.findOneOrCreate = async function (this: Model<QraftyConfigInterface, QraftyConfigModelInterface>, teamId: string): Promise<IQraftyConfig> {
  const self = this;
  let qraftyConfig = await self.findOne().exec();
  if (qraftyConfig) {
    return qraftyConfig;
  }

  const teamInstall = await Installation.findOne({ teamId: teamId }).exec();
  if (!teamInstall?.installation.bot?.token) {
    throw new Error('Installation not found');
  }
  const { members } = await app.client.users.list({ token: teamInstall.installation.bot.token, team_id: teamId });
  const admins = members?.filter((user) => user.is_admin === true).map((admin) => admin.id);
  qraftyConfig = new self({
    qraftyAdmins: admins
  });
  return await self.create(qraftyConfig);
};

export interface QraftyConfigInterface extends IQraftyConfig {
  // instance methods
}

export interface QraftyConfigModelInterface extends Model<QraftyConfigInterface> {
  // static methods
  findOneOrCreate(teamId: string): Promise<IQraftyConfig>;
}

export const QraftyConfig = (conn: Connection) =>
  conn.model<QraftyConfigInterface, QraftyConfigModelInterface>('qraftyConfig', QraftyConfigSchema);
