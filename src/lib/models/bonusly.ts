import { Connection, Document, Model, Schema } from 'mongoose';

import { AuditTags } from './auditTags';

export interface IBonuslyBotConfig extends Document {
  enabled: boolean;
  url?: URL;
  apiKey?: string;
  defaultReason?: string;
  defaultHashtag?: string;
}

export const BonuslyBotConfigSchema = new Schema({
  enabled: Boolean,
  url: String,
  apiKey: String,
  defaultReason: {
    type: String,
    default: 'point sent through Qrafty'
  },
  defaultHashtag: String,
});

BonuslyBotConfigSchema.statics.findOneOrCreate = async function (
  this: Model<any, any, any, any>,
): Promise<IBonuslyBotConfig> {
  const self = this;
  let botConfig = await self.findOne().exec();
  if (botConfig) {
    return botConfig;
  }

  botConfig = new self({
    enabled: false,
  });
  return await self.create(botConfig);
};

export interface BonuslyBotConfigInterface extends IBonuslyBotConfig {
  // instance methods
}

export interface BonuslyBotConfigModelInterface extends Model<BonuslyBotConfigInterface> {
  // static methods
  findOneOrCreate(): Promise<IBonuslyBotConfig>;
}

export const BonuslyBotConfig = (conn: Connection) =>
  conn.model<BonuslyBotConfigInterface, BonuslyBotConfigModelInterface>('bonuslyBotConfig', BonuslyBotConfigSchema);
