import { IUser, UserInterface } from '../models/user';
import { DirectionEnum } from './Enums';

interface EventWithTeamId {
  teamId: string;
}

export const PPEventName = 'plus-plus';
export interface PPEvent extends EventWithTeamId {
  sender: IUser;
  recipients: IUser[];
  channel: string;
  amount: number;
  direction: DirectionEnum;
  originalMessage: string;
  originalMessageTs: string;
  notificationMessage?: string;
  reason?: string;
  isThread: boolean;
}

export const PPFailureEventName = 'plus-plus-fail';
export interface PPFailureEvent extends EventWithTeamId {
  sender: string;
  recipients: string | string[];
  notificationMessage: string;
  channel?: string;
}

export const PPSpamEventName = 'plus-plus-spam';
export interface PPSpamEvent extends EventWithTeamId {
  sender: IUser;
  recipient: IUser;
  notificationMessage: string;
  reason?: string;
}

export const PPBonuslySentEventName = 'plus-plus-bonusly-sent';
export interface PPBonuslySentEvent {
  teamId: string;
  channel: string;
  responses: any[];
  sender: IUser;
  recipients: IUser[];
  originalMessage?: string;
  originalMessageTs: string;
  originalMessageIsThread: boolean;
}

export interface TerseBonuslySentPayload {
  responses?: any[];
  teamId: string;
  channel: string;
  senderId: string;
  recipientIds: string[];
  amount: number;
  originalMessageTs: string;
  originalMessageIsThread: boolean;
  reason?: string;
}