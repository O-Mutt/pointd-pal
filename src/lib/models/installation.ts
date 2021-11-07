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
  teamId: {
    type: String,
    index: true
  },
  installation: Schema.Types.Mixed,
  customerId: {
    type: String,
    index: true
  },
  subscriptionId: {
    type: String,
    index: true
  },
  subscriptionStatus: {
    type: String,
    enum: SubscriptionStatus
  }
});

InstallationSchema.index({ teamId: 1, customerId: 1 });

export interface InstallationInterface extends IInstallation {
  // instance methods
}

export interface InstallationModelInterface extends Model<InstallationInterface> {
  // static methods
}

export const Installation = connectionFactory().model<InstallationInterface, InstallationModelInterface>('installation', InstallationSchema);
