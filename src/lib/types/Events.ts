import { IUser, UserInterface } from '../models/user';
import { DirectionEnum } from './Enums';

abstract class EventWithTeamId {
  teamId: string;

  constructor(init: EventWithTeamId) {
    Object.assign(this, init);
  }
}

export const PlusPlusEventName = 'plus-plus';
export class PlusPlus extends EventWithTeamId {
  sender: IUser;
  recipients: IUser[];
  channel: string;
  amount: number;
  direction: DirectionEnum;
  originalMessage: string;
  originalMessageTs: string;
  notificationMessage?: string;
  reason?: string;
  isThread: boolean = false;

  // https://stackoverflow.com/a/37682352/593154
  constructor(init: Partial<PlusPlus> & EventWithTeamId) {
    super(init);
    Object.assign(this, init);
  }
}

export const PlusPlusFailureEventName = 'plus-plus-fail';
export class PlusPlusFailure extends EventWithTeamId {
  sender: IUser;
  recipient: IUser;
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
  sender: IUser;
  recipient: IUser;
  message?: string;
  reason?: string;

  // https://stackoverflow.com/a/37682352/593154
  constructor(init: Partial<PlusPlusSpam> & EventWithTeamId) {
    super(init);
    Object.assign(this, init);
  }
}

export const PlusPlusBonuslyEventName = 'plus-plus-bonusly-sent';
export class PlusPlusBonusly {
  teamId: string;
  channel: string;
  responses: any[];
  sender: IUser;
  recipients: IUser[];
  originalMessage?: string;
  originalMessageTs: string;

  constructor(init: Partial<PlusPlusBonusly>) {
    Object.assign(this, init);
  }
}

export class BonuslyPayload {
  responses?: any[];
  teamId: string;
  channel: string;
  sender: string;
  recipients: string[];
  amount: number;
  originalMessageTs: string;
  reason?: string;

  constructor(init: Partial<BonuslyPayload>) {
    Object.assign(this, init);
  }
}