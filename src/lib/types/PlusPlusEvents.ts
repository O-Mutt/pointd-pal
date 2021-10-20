import { IUser } from '../models/user';

export const PlusPlusEventName = 'plus-plus';

export class PlusPlus {
  notificationMessage?: string;
  sender?: IUser;
  recipients?: IUser[];
  direction?: DirectionEnum;
  amount?: number;
  channel?: string;
  reason?: string;

  // https://stackoverflow.com/a/37682352/593154
  constructor(init?: Partial<PlusPlus>) {
    Object.assign(this, init);
  }
}

export const PlusPlusFailureEventName = 'plus-plus-fail';
export class PlusPlusFailure {
  notificationMessage?: string;
  channel?: string;

  // https://stackoverflow.com/a/37682352/593154
  constructor(init?: Partial<PlusPlusFailure>) {
    Object.assign(this, init);
  }
}

export const PlusPlusSpamEventName = 'plus-plus-spam';
export class PlusPlusSpam {
  to?: IUser;
  from?: IUser;
  message?: string;
  reason?: string;

  // https://stackoverflow.com/a/37682352/593154
  constructor(init?: Partial<PlusPlusSpam>) {
    Object.assign(this, init);
  }
}

export enum DirectionEnum {
  PLUS = '++',
  MINUS = '--',
}
