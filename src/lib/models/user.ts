import { Connection, Document, Model, Schema } from 'mongoose';
import { ESMap } from 'typescript';

import { app } from '../../../app';
import { PromptSettings } from '../types/Enums';
import { AuditTags } from './auditTags';
import { Installation } from './installation';

export interface IUser extends Document, AuditTags {
  slackId: string;
  score: number;
  reasons: ESMap<string, number>;
  pointsGiven: ESMap<string, number>;
  robotDay: Date;
  accountLevel: number;
  totalPointsGiven: number;
  isAdmin: boolean;
  isBot: boolean;
  qraftyToken: number;
  email?: string;
  name?: string;
  bonuslyScoreOverride: number;
  bonuslyPrompt: string;
  walletAddress?: string;
  bonuslyPointsDM: boolean
}

export const UserSchema = new Schema({
  slackId: {
    type: String,
    index: true
  },
  score: {
    type: Number,
    default: 0,
  },
  reasons: {
    type: Map,
    of: Number,
    default: {},
  },
  pointsGiven: {
    type: Map,
    of: Number,
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
  qraftyToken: {
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
  bonuslyPointsDM: {
    type: Boolean,
    default: true,
  },
});


UserSchema.statics.findOneBySlackIdOrCreate = async function (
  this: Model<UserInterface, UserModelInterface>,
  teamId: string,
  slackId: string,
): Promise<IUser> {
  const self: Model<UserInterface, UserModelInterface> = this;
  let user = await self.findOne({ slackId }, null, { sort: { score: -1 } }).exec();
  if (user) {
    return user;
  }

  const teamInstall = await Installation.findOne({ teamId: teamId }).exec();
  if (!teamInstall?.installation.bot?.token) {
    throw new Error('Installation not found');
  }
  // We will need to store and get the token for the client's specific team api
  const { user: slackUser } = await app.client.users.info({ token: teamInstall.installation.bot.token, user: slackId });
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
  findOneBySlackIdOrCreate(teamId: string, slackId: string): Promise<IUser>;
}

export const User = (conn: Connection) => conn.model<UserInterface, UserModelInterface>('score', UserSchema);
