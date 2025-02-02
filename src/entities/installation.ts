import { Schema, Document, Model, model } from 'mongoose';
import { connectionFactory } from '../lib/services/connectionsFactory';
import { Installation as OAuthInstallation } from '@slack/oauth';

export interface IInstallation extends Document {
	teamId: string;
	installation: OAuthInstallation;
	customerId: string;
	enabled: boolean;
}

export const InstallationSchema = new Schema({
	teamId: {
		type: String,
		index: true,
	},
	installation: Schema.Types.Mixed,
	customerId: {
		type: String,
		index: true,
	},
	enabled: {
		type: Boolean,
		default: true,
	},
});

InstallationSchema.index({ teamId: 1, customerId: 1 });

export interface InstallationInterface extends IInstallation {
	// instance methods
}

export interface InstallationModelInterface extends Model<InstallationInterface> {
	// static methods
}

export const Installation = connectionFactory().model<InstallationInterface, InstallationModelInterface>(
	'installation',
	InstallationSchema,
);
