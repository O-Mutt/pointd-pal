import { InstallationStore, OrgInstallation } from "@slack/oauth";
import { Installation } from "../models/installation"


export const QraftyInstallStore: InstallationStore = {
  storeInstallation: async (installation) => {
    // change the lines below so they save to your database
    if (installation.isEnterpriseInstall && installation.enterprise !== undefined) {
      // support for org-wide app installation
      console.log("[INSTALL] org wide", installation);
      await Installation.create({
        teamId: installation.enterprise.id,
        installation: installation
      });
      return;
    }
    if (installation.team !== undefined) {
      // single team app installation
      console.log("[INSTALL] single team", installation);
      await Installation.create({
        teamId: installation.team.id,
        installation: installation
      });
      return;
    }
    throw new Error('Failed saving installation data to installationStore');
  },
  fetchInstallation: async (installQuery) => {
    // change the lines below so they fetch from your database
    if (installQuery.isEnterpriseInstall && installQuery.enterpriseId !== undefined) {
      // org wide app installation lookup
      console.log("[LOOKUP] org wide app", installQuery);
      const result = await Installation.findOne({ teamId: installQuery.enterpriseId }).exec();
      if (!result) {
        throw new Error('Failed fetching installation');
      }
      return result.installation as OrgInstallation;
    }
    if (installQuery.teamId !== undefined) {
      // single team app installation lookup
      console.log("[LOOKUP] single team app", installQuery);
      const result = await Installation.findOne({ teamId: installQuery.teamId }).exec();
      if (!result) {
        throw new Error('Failed fetching installation');
      }
      return result.installation as OrgInstallation;
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