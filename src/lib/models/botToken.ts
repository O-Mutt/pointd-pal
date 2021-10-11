import { Schema, Document, model, Model } from 'mongoose';

export interface IBotToken extends Document {
    name: string;
    publicWalletAddress: string;
    token: number;
    magicString: string;
}

export const BotTokenSchema = new Schema({
  name: String,
  publicWalletAddress: String,
  token: Number,
  magicString: String
});



export interface BotTokenInterface extends IBotToken {
// instance methods
}

export interface BotTokenInterfaceModelInterface extends Model<BotTokenInterface> {
  // static methods
}

export const BotToken = model<BotTokenInterface, BotTokenInterfaceModelInterface>("botWallet", BotTokenSchema);

