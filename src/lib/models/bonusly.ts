import { Schema, Document, Model, Connection } from 'mongoose';

export interface IBonuslyBotConfig extends Document {
  enabled: boolean;
  url?: URL;
  apiKey?: string;
  defaultReason?: string;
  defaultHashtag?: string;
  scoreOverride?: number;
}

export const BonuslyBotConfigSchema = new Schema({
  enabled: Boolean,
  url: String,
  apiKey: String,
  defaultReason: String,
  defaultHashtag: String,
  scoreOverride: Number,
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

export interface BonuslyBotConfigInterfaceModelInterface extends Model<BonuslyBotConfigInterface> {
  // static methods
  findOneOrCreate(): Promise<IBonuslyBotConfig>;
}

export const BonuslyBotConfig = (conn: Connection) =>
  conn.model<BonuslyBotConfigInterface, BonuslyBotConfigInterfaceModelInterface>(
    'bonuslyBotConfig',
    BonuslyBotConfigSchema,
  );
