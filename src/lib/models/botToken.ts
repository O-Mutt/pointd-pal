import { Schema, Document, model, Model } from 'mongoose';
import { connectionFactory } from '../services/connectionsFactory';

export interface IBotToken extends Document {
  enabled: boolean;
  name: string;
  publicWalletAddress: string;
  token: number;
  magicString: string;
}

export const BotTokenSchema = new Schema({
  enabled: Boolean,
  name: String,
  publicWalletAddress: String,
  token: Number,
  magicString: String,
});

export interface BotTokenInterface extends IBotToken {
  // instance methods
}

export interface BotTokenInterfaceModelInterface extends Model<BotTokenInterface> {
  // static methods
}

export const BotToken = () =>
  connectionFactory().model<BotTokenInterface, BotTokenInterfaceModelInterface>('botToken', BotTokenSchema);
