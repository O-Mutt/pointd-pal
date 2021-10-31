import { InstallationStore, Installation as OAuthInstallation } from "@slack/oauth";
import { Installation } from "../models/installation"


export const QraftyInstallStore: InstallationStore = {
  storeInstallation: async (installation) => {
    // change the lines below so they save to your database
    if (installation.isEnterpriseInstall && installation.enterprise !== undefined) {
      // support for org-wide app installation
      console.log("[INSTALL] org wide", installation.enterprise.id);
      await Installation.findOneOrCreate(
        installation.enterprise.id,
        installation,
      );
      return;
    }
    if (installation.team !== undefined) {
      // single team app installation
      console.log("[INSTALL] single team", installation.team.id);
      await Installation.findOneOrCreate(
        installation.team.id,
        installation,
      );
      return;
    }
    throw new Error('Failed saving installation data to installationStore');
  },
  fetchInstallation: async (installQuery) => {
    // change the lines below so they fetch from your database
    if (installQuery.isEnterpriseInstall && installQuery.enterpriseId !== undefined) {
      // org wide app installation lookup
      console.log("[LOOKUP] org wide app", installQuery.enterpriseId);
      const result = await Installation.findOne({ teamId: installQuery.enterpriseId }).exec();
      if (!result) {
        throw new Error('Failed fetching installation');
      }
      return result.installation as OAuthInstallation<"v1" | "v2", boolean>;
    }
    if (installQuery.teamId !== undefined) {
      // single team app installation lookup
      console.log("[LOOKUP] single team app", installQuery.teamId);
      const result = await Installation.findOne({ teamId: installQuery.teamId }).exec();
      if (!result) {
        throw new Error('Failed fetching installation');
      }
      return result.installation as OAuthInstallation<"v1" | "v2", boolean>;
    }
    throw new Error('Failed fetching installation');
  },
  deleteInstallation: async (installQuery) => {
    // change the lines below so they delete from your database
    if (installQuery.isEnterpriseInstall && installQuery.enterpriseId !== undefined) {
      // org wide app installation deletion
      await Installation.deleteOne({ teamId: installQuery.enterpriseId }).exec();
      return;
    }
    if (installQuery.teamId !== undefined) {
      // single team app installation deletion
      await Installation.deleteOne({ teamId: installQuery.teamId }).exec();
      return;
    }
    return;
    throw new Error('Failed to delete installation');
  },
};