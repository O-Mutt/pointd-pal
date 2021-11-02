import { InstallationStore, Installation as OAuthInstallation, InstallationQuery } from '@slack/oauth';
import { Installation } from '../models/installation'


export const QraftyInstallStore: InstallationStore = {
  storeInstallation: async (installation) => {

    let teamId;
    if (installation.isEnterpriseInstall && installation.enterprise !== undefined) {
      console.log(`[INSTALL] org wide ${installation.enterprise.id}`);
      teamId = installation.enterprise.id;
    }
    if (installation.team !== undefined) {
      console.log(`[INSTALL] single team ${installation.team.id}`);
      teamId = installation.team.id;
    }

    if (teamId) {
      await Installation.remove({ teamId });
      await Installation.create({
        teamId,
        installation,
      });
      return;
    }
    throw new Error('Failed saving installation data to installationStore');
  },
  fetchInstallation: async (installQuery: InstallationQuery<boolean>): Promise<OAuthInstallation<'v1' | 'v2', boolean>> => {
    let teamId;
    if (installQuery.isEnterpriseInstall && installQuery.enterpriseId !== undefined) {
      console.log(`[LOOKUP] org wide app ${installQuery.enterpriseId}`);
      teamId = installQuery.enterpriseId;
    }
    if (installQuery.teamId !== undefined) {
      console.log(`[LOOKUP] single team app ${installQuery.teamId}`);
      teamId = installQuery.teamId;
    }

    if (teamId) {
      const result = await Installation.findOne({ teamId }).exec();
      if (!result) {
        throw new Error('Failed fetching installation');
      }
      console.log(`[LOOKUP]  ${teamId}.`)
      return result.installation as OAuthInstallation<'v1' | 'v2', boolean>;
    }

    throw new Error('Failed fetching installation, failed overall');
  },
  deleteInstallation: async (installQuery: InstallationQuery<boolean>): Promise<void> => {
    let teamId;
    if (installQuery.isEnterpriseInstall && installQuery.enterpriseId !== undefined) {
      teamId = installQuery.enterpriseId;
    }
    if (installQuery.teamId !== undefined) {
      teamId = installQuery.teamId;
    }

    if (teamId) {
      await Installation.deleteOne({ teamId }).exec();
    }
    throw new Error('Failed to delete installation');
  },
};