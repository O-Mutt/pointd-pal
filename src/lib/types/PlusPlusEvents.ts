import { IUser } from "../models/user";

export class PlusPlus {
  notificationMessage?: string;
  sender?: IUser;
  recipient?: IUser;
  direction?: DirectionEnum;
  amount?: number;
  channel?: string;
  reason?: string;
  
  // https://stackoverflow.com/a/37682352/593154
  constructor(init?:Partial<PlusPlus>) {
    Object.assign(this, init);
  }
}

export class PlusPlusFailure {
  notificationMessage?: string;
  channel?: string;

  // https://stackoverflow.com/a/37682352/593154
  constructor(init?: Partial<PlusPlusFailure>) {
    Object.assign(this, init);
  }
}

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
  PLUS = "++",
  MINUS = "--"
};