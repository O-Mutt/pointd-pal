import { Schema, Document, Model, model } from 'mongoose';
import { connectionFactory } from '../services/connectionsFactory';
import { Installation as OAuthInstallation } from "@slack/oauth";

export interface IInstallation extends Document {
  teamId: string;
  installation: OAuthInstallation;
}

export const InstallationSchema = new Schema({
  teamId: String,
  installation: Schema.Types.Mixed,
});

InstallationSchema.statics.findOneOrCreate = async function (
  this: Model<InstallationInterface, InstallationModelInterface>,
  teamId: string,
  installation: OAuthInstallation
): Promise<IInstallation> {
  const self: Model<InstallationInterface, InstallationModelInterface> = this;
  let install = await self.findOne({ teamId }).exec();
  if (install) {
    return install;
  }

  const teamInstall = new self({
    teamId,
    installation
  });
  return await self.create(teamInstall);
};

export interface InstallationInterface extends IInstallation {
  // instance methods
}

export interface InstallationModelInterface extends Model<InstallationInterface> {
  // static methods
  findOneOrCreate(teamId: string): Promise<IInstallation>;
}

export const Installation = connectionFactory().model<InstallationInterface, InstallationModelInterface>('installation', InstallationSchema);
