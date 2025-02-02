import { AuditTags } from './auditTags';
import { Installation } from './installation';

export interface IUser extends AuditTags {
	slackId: string;
	score: number;
	reasons: Record<string, number>;
	pointsGiven: Record<string, number>;
	pointdPalDay: Date;
	accountLevel: number;
	totalPointsGiven: number;
	isAdmin: boolean;
	isBot: boolean;
	pointdPalToken: number;
	email?: string;
	name?: string;
	walletAddress?: string;
}

export async function findOneBySlackIdOrCreate(teamId: string, slackId: string): Promise<IUser> {
	let user = await getConnection()
		.findOne({ slackId }, null, { sort: { score: -1 } })
		.exec();
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
}

export interface UserInterface extends IUser {
	// instance methods
}

export interface UserModelInterface extends Model<UserInterface> {
	// static methods
	findOneBySlackIdOrCreate(teamId: string, slackId: string): Promise<IUser>;
}

export const User = (conn: Connection) => conn.model<UserInterface, UserModelInterface>('user', UserSchema);
