export async function getAllUsersByTeam(teamId: string): Promise<IUser[]> {
	return await User(connectionFactory(teamId)).find({}).exec();
}
