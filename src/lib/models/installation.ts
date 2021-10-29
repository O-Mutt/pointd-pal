import { Schema, Document, Model, model } from 'mongoose';

export interface IInstallation extends Document {
  teamId: string;
  installation: object;
}

export const InstallationSchema = new Schema({
  teamId: String,
  installation: Object,
});

export interface InstallationInterface extends IInstallation {
  // instance methods
}

export interface InstallationModelInterface extends Model<InstallationInterface> {
  // static methods
}

export const Installation = model<InstallationInterface, InstallationModelInterface>('installation', InstallationSchema);
