import { InstallationStore, Installation as OAuthInstallation, InstallationQuery } from '@slack/oauth';
import { app } from '../../../app';
import { IInstallation, Installation } from '../../entities/installation';

export const PointdPalInstallStore: InstallationStore = {
  storeInstallation: async (installation) => {
    let teamId;
    let teamName;
    let email;
    if (installation.isEnterpriseInstall && installation.enterprise !== undefined) {
      console.log(`[INSTALL] org wide ${installation.enterprise.id}`);
      teamId = installation.enterprise.id;
      teamName = installation.enterprise.name;
    }
    if (installation.team !== undefined) {
      console.log(`[INSTALL] single team ${installation.team.id}`);
      teamId = installation.team.id;
      teamName = installation.team.name;
    }

    if (installation.bot?.token) {
      const { user } = await app.client.users.info({
        token: installation.bot?.token,
        user: installation.user.id,
      });
      email = user?.profile?.email;
    }

    let install: IInstallation | null;
    if (teamId) {
      install = await Installation.findOne({ teamId });
      if (install) {
        await Installation.deleteOne({ teamId });
      }

      await Installation.create({
        teamId,
        installation,
      });

      return;
    }
    throw new Error('Failed saving installation data to installationStore');
  },
  fetchInstallation: async (
    installQuery: InstallationQuery<boolean>,
  ): Promise<OAuthInstallation<'v1' | 'v2', boolean>> => {
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
      console.log(`[LOOKUP]  ${teamId}.`);
      if (!result.enabled) {
        throw new Error(
          `This instance of pointdPal is not enabled Team [${result.teamId}], Customer [${result.customerId}], Subscription [${result.subscriptionId}], Status [${result.subscriptionStatus}]`,
        );
      }
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
