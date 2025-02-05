export interface IScoreLog {
	from: string;
	to: string;
	date: Date;
	channelId: string;
	channelName?: string;
	// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
	scoreChange: 1 | -1 | number;
	reason?: string;
}
