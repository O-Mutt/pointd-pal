import { IUser } from '../models/user';

abstract class EventWithTeamId {
  teamId?: string;

  constructor(init?: Partial<EventWithTeamId>) {
    Object.assign(this, init);
  }
}

export const PlusPlusEventName = 'plus-plus';
export class PlusPlus extends EventWithTeamId {
  notificationMessage?: string;
  sender?: IUser;
  recipients?: IUser[];
  direction?: DirectionEnum;
  amount?: number;
  channel?: string;
  reason?: string;

  // https://stackoverflow.com/a/37682352/593154
  constructor(init?: Partial<PlusPlus>) {
    super(init);
    Object.assign(this, init);
  }
}

export const PlusPlusFailureEventName = 'plus-plus-fail';
export class PlusPlusFailure extends EventWithTeamId {
  notificationMessage?: string;
  channel?: string;

  // https://stackoverflow.com/a/37682352/593154
  constructor(init?: Partial<PlusPlusFailure>) {
    super(init);
    Object.assign(this, init);
  }
}

export const PlusPlusSpamEventName = 'plus-plus-spam';
export class PlusPlusSpam extends EventWithTeamId {
  to?: IUser;
  from?: IUser;
  message?: string;
  reason?: string;

  // https://stackoverflow.com/a/37682352/593154
  constructor(init?: Partial<PlusPlusSpam>) {
    super(init);
    Object.assign(this, init);
  }
}

export enum DirectionEnum {
  PLUS = '++',
  MINUS = '--',
}
