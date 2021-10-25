import { Connection, Document, Model, Schema } from 'mongoose';

import { app } from '../../../app';
import { PromptSettings } from '../types/Enums';
import { AuditTags } from './auditTags';

export interface IUser extends Document, AuditTags {
  slackId: string;
  score: number;
  reasons: object;
  pointsGiven: object;
  robotDay: Date;
  accountLevel: number;
  totalPointsGiven: number;
  isAdmin: boolean;
  isBot: boolean;
  email?: string;
  name?: string;
  token?: number;
  bonuslyScoreOverride?: number;
  bonuslyPrompt?: string;
  walletAddress?: string;
}

export const UserSchema = new Schema({
  slackId: String,
  score: {
    type: Number,
    default: 0,
  },
  reasons: {
    type: Object,
    default: {},
  },
  pointsGiven: {
    type: Object,
    default: {},
  },
  robotDay: {
    type: Date,
    default: new Date(),
  },
  accountLevel: {
    type: Number,
    default: 1,
  },
  totalPointsGiven: {
    type: Number,
    default: 0,
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  isBot: {
    type: Boolean,
    default: false,
  },
  email: String,
  name: String,
  token: {
    type: Number,
    default: 0,
  },
  bonuslyScoreOverride: {
    type: Number,
    default: 1,
  },
  bonuslyPrompt: {
    type: String,
    enum: PromptSettings,
    default: PromptSettings.PROMPT,
  },
  walletAddress: String,
});

UserSchema.statics.findOneBySlackIdOrCreate = async function (
  this: Model<UserInterface, UserModelInterface>,
  slackId: string,
): Promise<IUser> {
  const self: Model<UserInterface, UserModelInterface> = this;
  let user = await self.findOne({ slackId }, null, { sort: { score: -1 } }).exec();
  if (user) {
    return user;
  }

  // We will need to store and get the token for the client's specific team api
  const { user: slackUser } = await app.client.users.info({ user: slackId });
  user = new self({
    slackId,
    score: 0,
    reasons: {},
    pointsGiven: {},
    robotDay: new Date(),
    accountLevel: 1,
    totalPointsGiven: 0,
    email: slackUser?.profile?.email,
    name: slackUser?.name,
    isAdmin: slackUser?.is_admin,
    isBot: slackUser?.is_bot,
    updatedBy: slackId,
    updatedAt: new Date(),
  });
  return await self.create(user);
};

export interface UserInterface extends IUser {
  // instance methods
}

export interface UserModelInterface extends Model<UserInterface> {
  // static methods
  findOneBySlackIdOrCreate(slackId: string): Promise<IUser>;
}

export const User = (conn: Connection) => conn.model<UserInterface, UserModelInterface>('score', UserSchema);
