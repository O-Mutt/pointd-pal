import { Schema, Document, Model, Connection } from 'mongoose';
import { BonuslyBotConfigSchema, IBonuslyBotConfig } from './bonusly';

export const DefaultNotificationRoomName = 'qrafty-plusplus-notifications';
export interface IQraftyConfig extends Document {
  slackToken?: string;
  notificationRoom?: string;
  falsePositiveRoom?: string;
  formalFeedbackUrl?: string;
  formalFeedbackModulo: number;
  reasonsKeyword?: string;
  companyName?: string;
  bonuslyConfig?: IBonuslyBotConfig;
}

export const QraftyConfigSchema = new Schema({
  slackToken: String,
  notificationRoom: String,
  falsePositiveRoom: String,
  formalFeedbackUrl: String,
  formalFeedbackModulo: Number,
  companyName: String,
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

export interface QraftyBotConfigModelInterface extends Model<QraftyConfigInterface> {
  // static methods
  findOneOrCreate(): Promise<IBonuslyBotConfig>;
}

export const QraftyConfig = (conn: Connection) =>
  conn.model<QraftyConfigInterface, QraftyBotConfigModelInterface>('qraftyConfig', QraftyConfigSchema);
