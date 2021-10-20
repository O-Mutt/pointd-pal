import { Schema, Document, Model, Connection } from 'mongoose';

export interface IBonuslyBotConfig extends Document {
  enabled: boolean;
  url: URL;
  apiKey: string;
  defaultReason: string;
  defaultHashtag: string;
}

export const BonuslyBotConfigSchema = new Schema({
  enabled: Boolean,
  url: String,
  apiKey: String,
  defaultReason: String,
  defaultHashtag: String,
});

export interface BonuslyBotConfigInterface extends IBonuslyBotConfig {
  // instance methods
}

export interface BonuslyBotConfigInterfaceModelInterface extends Model<BonuslyBotConfigInterface> {
  // static methods
}

export const BonuslyBotConfig = (conn: Connection) =>
  conn.model<BonuslyBotConfigInterface, BonuslyBotConfigInterfaceModelInterface>(
    'bonuslyBotConfig',
    BonuslyBotConfigSchema,
  );
