import { app } from '../../../app';

export const scoresDocumentName = 'scores';

export type User = {
  name: string,
  score: number,
  reasons: StringCounterObject,
  pointsGiven: StringCounterObject,
  robotDay: Date,
  accountLevel: number,
  totalPointsGiven: number,
  slackId?: string,
  slackEmail?: string;
  token?: number
};

export type StringCounterObject = {
  [key: string]: number
}

export async function createNewLevelOneUser(user: any): Promise<User> {
  const userName = user.name ? user.name : user;

  const newUser: User = {
    name: userName,
    score: 0,
    reasons: { },
    pointsGiven: { },
    robotDay: new Date(),
    accountLevel: 1,
    totalPointsGiven: 0,
  };
  if (user.id) {
    newUser.slackId = user.id;
  }
  newUser.slackEmail = getEmail(user);

  if (newUser.slackId && !newUser.slackEmail) {
    const { slackUser } = await app.client.users.info({ user: newUser.slackId });
    newUser.slackEmail = getEmail(slackUser);
  }

  return newUser;
}

function getEmail(user: any) {
  if (user.profile && user.profile.email) {
    return user.profile.email;
  } else if (user.info && user.info.email_address) {
    return user.info.email_address;
  }
  return undefined;
}
