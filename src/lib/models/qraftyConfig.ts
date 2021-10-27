import { Schema, Document, Model, Connection } from 'mongoose';
import { AuditTags } from './auditTags';
import { BonuslyBotConfigSchema, IBonuslyBotConfig } from './bonusly';

export interface IQraftyConfig extends Document, AuditTags {
  slackToken?: string;
  notificationRoom?: string;
  falsePositiveRoom?: string;
  formalFeedbackUrl?: string;
  formalFeedbackModulo: number;
  reasonsKeyword?: string;
  companyName?: string;
  qryptoEnabled?: boolean;
  bonuslyConfig?: IBonuslyBotConfig;
}

export const QraftyConfigSchema = new Schema({
  slackToken: String,
  notificationRoom: String,
  falsePositiveRoom: String,
  formalFeedbackUrl: String,
  formalFeedbackModulo: Number,
  companyName: String,
  qryptoEnabled: {
    type: Boolean,
    default: false
  },
  bonuslyConfig: BonuslyBotConfigSchema,
});

QraftyConfigSchema.statics.findOneOrCreate = async function (this: Model<any, any, any, any>): Promise<IQraftyConfig> {
  const self = this;
  let qraftyConfig = await self.findOne().exec();
  if (qraftyConfig) {
    return qraftyConfig;
  }

  qraftyConfig = new self({});
  return await self.create(qraftyConfig);
};

export interface QraftyConfigInterface extends IQraftyConfig {
  // instance methods
}

export interface QraftyConfigModelInterface extends Model<QraftyConfigInterface> {
  // static methods
  findOneOrCreate(): Promise<IQraftyConfig>;
}

export const QraftyConfig = (conn: Connection) =>
  conn.model<QraftyConfigInterface, QraftyConfigModelInterface>('qraftyConfig', QraftyConfigSchema);
