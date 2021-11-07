import { Schema, Document, Model, model } from 'mongoose';
import { connectionFactory } from '../services/connectionsFactory';
import { Installation as OAuthInstallation } from "@slack/oauth";
import { SubscriptionStatus } from '../types/Enums';

export interface IInstallation extends Document {
  teamId: string;
  installation: OAuthInstallation;
  customerId: string;
  subscriptionId: string;
  subscriptionStatus: SubscriptionStatus;
}

export const InstallationSchema = new Schema({
  teamId: String,
  installation: Schema.Types.Mixed,
  customerId: String,
  subscriptionId: String,
  subscriptionStatus: SubscriptionStatus
});

export interface InstallationInterface extends IInstallation {
  // instance methods
}

export interface InstallationModelInterface extends Model<InstallationInterface> {
  // static methods
}

export const Installation = connectionFactory().model<InstallationInterface, InstallationModelInterface>('installation', InstallationSchema);
