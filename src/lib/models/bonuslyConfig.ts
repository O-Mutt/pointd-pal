import { Connection, Document, Model, Schema } from 'mongoose';
import { Helpers as H } from '../helpers';


export interface IBonuslyConfig extends Document {
  enabled: boolean;
  url?: URL;
  apiKey?: string;
  defaultReason: string;
  defaultHashtag: string;
}

export const BonuslyConfigSchema = new Schema({
  enabled: Boolean,
  url: String,
  apiKey: {
    type: String,
    get: key => H.obfuscate(key, 3)
  },
  defaultReason: {
    type: String,
    default: 'point sent through PointdPal'
  },
  defaultHashtag: {
    type: String,
    default: '#excellence'
  },
});

BonuslyConfigSchema.statics.findOneOrCreate = async function (
  this: Model<any, any, any, any>,
): Promise<IBonuslyConfig> {
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

export interface BonuslyConfigInterface extends IBonuslyConfig {
  // instance methods
}

export interface BonuslyConfigModelInterface extends Model<BonuslyConfigInterface> {
  // static methods
  findOneOrCreate(): Promise<IBonuslyConfig>;
}

export const BonuslyConfig = (conn: Connection) =>
  conn.model<BonuslyConfigInterface, BonuslyConfigModelInterface>('bonuslyConfig', BonuslyConfigSchema);
