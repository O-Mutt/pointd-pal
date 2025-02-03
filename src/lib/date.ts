import { withNamespace } from '@/logger';
import config from '@config';
import { differenceInYears, getDayOfYear } from 'date-fns';

const logger = withNamespace('DateUtil');
export class DateUtil {
	static isCakeDay(dateObject: Date): boolean {
		try {
			const pointdPalDay = getDayOfYear(dateObject);
			const today = getDayOfYear(new Date());
			if (pointdPalDay === today) {
				return true;
			}
		} catch (e) {
			logger.debug('There was an error in the isCakeDay function', e);
		}
		return false;
	}

	static getYearsAsString(pointdPalDay: Date): string {
		const today = new Date();
		const years = differenceInYears(today, pointdPalDay);
		return this.getOrdinalSuffix(years);
	}

	static isScoreboardDayOfWeek(dayOfWeek: number = 1): boolean {
		//Logger.debug(`Run the cron but lets check what day it is Moment day: [${moment().day()}], Configured Day of Week: [${monthlyScoreboardDayOfWeek}], isThatDay: [${moment().day() === monthlyScoreboardDayOfWeek}]`);
		const scoreboardDayOfWeek = config.get('scoreboard.dayOfWeek');
		const isToday = new Date().getUTCDay() === dayOfWeek;
		return isToday;
	}

	private static getOrdinalSuffix(num: number): string {
		const j = num % 10;
		const k = num % 100;
		if (j === 1 && k !== 11) {
			return `${num}st`;
		}
		if (j === 2 && k !== 12) {
			return `${num}nd`;
		}
		if (j === 3 && k !== 13) {
			return `${num}rd`;
		}
		return `${num}th`;
	}
}

declare global {
	interface Date {
		isCakeDay(): boolean;
		getYearsAsString(): string;
	}
}
Date.prototype.isCakeDay = function (): boolean {
	return DateUtil.isCakeDay(this);
};

Date.prototype.getYearsAsString = function (): string {
	return DateUtil.getYearsAsString(this);
};
