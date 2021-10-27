import { IUser } from '../models/user';
import { DirectionEnum } from './Enums';

abstract class EventWithTeamId {
  teamId: string;

  constructor(init: EventWithTeamId) {
    this.teamId = init.teamId;
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
  constructor(init: Partial<PlusPlus> & EventWithTeamId) {
    super(init);
    Object.assign(this, init);
  }
}

export const PlusPlusFailureEventName = 'plus-plus-fail';
export class PlusPlusFailure extends EventWithTeamId {
  notificationMessage?: string;
  channel?: string;

  // https://stackoverflow.com/a/37682352/593154
  constructor(init: Partial<PlusPlusFailure> & EventWithTeamId) {
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
  constructor(init: Partial<PlusPlusSpam> & EventWithTeamId) {
    super(init);
    Object.assign(this, init);
  }
}
