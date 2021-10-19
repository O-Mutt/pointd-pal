import { Schema, Document, Model, Connection } from 'mongoose';
import { app } from '../../../app';
import { connectionFactory } from '../services/connectionsFactory';

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

UserSchema.statics.findOneBySlackIdOrCreate = async function (this: Model<any, any, any, any>, teamId: string, slackId: string): Promise<IUser> {
  const self = this;
  let user = await self.findOne({ slackId }, null, { sort: { score: -1 } }).exec()
  if (user) {
    return user;
  }

  const { user: slackUser } = await app.client.users.info({ user: slackId });
  const UserWithConnection = User(connectionFactory(teamId));
  user = new UserWithConnection({
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

export const User = (conn: Connection) => conn.model<UserInterface, UserModelInterface>("score", UserSchema);

