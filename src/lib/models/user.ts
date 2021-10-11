import { Schema, Document, model, Model } from 'mongoose';
import { app } from '../../../app';

export interface IUser extends Document {
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
}

export const UserSchema = new Schema({
  slackId: String,
  score: {
    type: Number,
    default: 0
  },
  reasons: {
    type: Object,
    default: {}
  },
  pointsGiven: {
    type: Object,
    default: {}
  },
  robotDay: {
    type: Date,
    default: new Date()
  },
  accountLevel: 
  {
    type: Number,
    default: 1
  },
  totalPointsGiven: 
  {
    type: Number,
    default: 0
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  isBot: {
    type: Boolean,
    default: false
  },
  email: String,
  name: String,
  token: Number
});

UserSchema.statics.findOneBySlackIdOrCreate = async (slackId) => {
  const self = this as unknown as Model<IUser>;
  let user = await self.findOne({ slackId }, null, { sort: { score: -1 } }).exec()
  if (user) {
    return user;
  }

  const { user: slackUser } = await app.client.users.info({ user: slackId });
  user = new User({
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
    isBot: slackUser?.is_bot
  });
  return await self.create(user);
}

export interface UserInterface extends IUser {
// instance methods
}

export interface UserModelInterface extends Model<UserInterface> {
  // static methods
  findOneBySlackIdOrCreate(slackId: string): Promise<IUser>;
}

export const User = model<UserInterface, UserModelInterface>("score", UserSchema);

