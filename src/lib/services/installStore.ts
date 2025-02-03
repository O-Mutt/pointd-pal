import { Installation, InstallationQuery, InstallationStore } from '@slack/bolt';
import { app } from '../../../app';
import { IInstallation } from '../../entities/installation';
import * as installService from './installService';

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
			install = await installService.findOne(teamId);
			if (install) {
				await installService.deleteOne(teamId);
			}

			await installService.create(teamId, installation, email);

			return;
		}
		throw new Error('Failed saving installation data to installationStore');
	},
	fetchInstallation: async (installQuery: InstallationQuery<boolean>): Promise<Installation> => {
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
			const result = await installService.findOne(teamId);
			if (!result) {
				throw new Error('Failed fetching installation');
			}
			console.log(`[LOOKUP]  ${teamId}.`);
			if (!result.isEnabled) {
				throw new Error(
					`This instance of pointdPal is not enabled Team [${result.teamId}], Customer [${result.customerId}]`, //, Subscription [${result.subscriptionId}], Status [${result.subscriptionStatus}]`,
				);
			}
			return result.installation as Installation;
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
			await installService.deleteOne(teamId);
		}
		throw new Error('Failed to delete installation');
	},
};
