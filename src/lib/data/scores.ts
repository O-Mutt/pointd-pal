import { app } from '../../../app';

export const scoresDocumentName = 'scores';

export class User {
  _id?: string;
  id: string;
  score: number;
  reasons: StringCounterObject;
  pointsGiven: StringCounterObject;
  robotDay: Date;
  accountLevel: number;
  totalPointsGiven: number;
  isAdmin: boolean
  isBot: boolean;
  email?: string;
  name?: string;
  token?: number;

  constructor(userArgs) {
    this._id = userArgs._id;
    this.id = userArgs.id;
    this.score = userArgs.score || 0;
    this.reasons = userArgs.reasons || {};
    this.pointsGiven = userArgs.pointsGiven || {};
    this.robotDay = userArgs.robotDay || new Date();
    this.accountLevel = userArgs.accountLevel || 1;
    this.totalPointsGiven = userArgs.accountLevel || 1;
    this.email = userArgs.email;
    this.name = userArgs.name;
    this.token = userArgs.token;
    this.isAdmin = userArgs.admin || false;
    this.isBot = userArgs.admin || false;
  }
};

export type StringCounterObject = {
  [key: string]: number
}

export async function createNewLevelOneUser(userId: string, logger: any): Promise<User> {
  const { user } = await app.client.users.info({ user: userId });
  logger.debug('got user info', user);
  const newUser: User = new User({
    id: userId,
    score: 0,
    reasons: {},
    pointsGiven: {},
    robotDay: new Date(),
    accountLevel: 1,
    totalPointsGiven: 0,
    email: user?.profile?.email,
    name: user?.name,
    admin: user?.is_admin,
    bot: user?.is_bot
  });
  return newUser;
}
