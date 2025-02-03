export interface IScoreLog {
	from: string;
	to: string;
	date: Date;
	channel: string;
	scoreChange: number;
	reason?: string;
}
