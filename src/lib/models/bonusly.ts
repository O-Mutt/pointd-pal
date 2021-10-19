import { Schema, Document, Model, Connection } from 'mongoose';
import { Url } from 'url';

export interface IBonuslyBotConfig extends Document {
    url: Url;
    apiKey: string;
    defaultReason: string;
    defaultHashtag: string;
}

export const BonuslyBotConfigSchema = new Schema({
  url: URL,
  apiKey: String,
  defaultReason: String,
  defaultHashtag: String
});



export interface BonuslyBotConfigInterface extends IBonuslyBotConfig {
// instance methods
}

export interface BonuslyBotConfigInterfaceModelInterface extends Model<BonuslyBotConfigInterface> {
  // static methods
}

export const BonuslyBotConfig = (conn: Connection) => conn.model<BonuslyBotConfigInterface, BonuslyBotConfigInterfaceModelInterface>("bonuslyBotConfig", BonuslyBotConfigSchema);

