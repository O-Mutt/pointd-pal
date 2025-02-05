import { app } from '@/app';
import { IInstallation } from '@/entities/installation';
import * as installService from '@/lib/services/installService';
import { withNamespace } from '@/logger';
import { Installation, InstallationQuery, InstallationStore } from '@slack/bolt';

const logger = withNamespace('installStore');

export const PointdPalInstallStore: InstallationStore = {
	storeInstallation: async (installation) => {
		let teamId: string | undefined;
		let teamName: string | undefined;
		let email: string | undefined;
		if (installation.isEnterpriseInstall && installation.enterprise !== undefined) {
			logger.info(`[INSTALL] org wide ${installation.enterprise.id}`);
			teamId = installation.enterprise.id;
			teamName = installation.enterprise.name;
		}
		if (installation.team !== undefined) {
			logger.info(`[INSTALL] single team ${installation.team.id}`);
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

			await installService.create(teamId, installation, email ?? `someRando@${teamName}.com`);

			return;
		}
		throw new Error('Failed saving installation data to installationStore');
	},
	fetchInstallation: async (installQuery: InstallationQuery<boolean>): Promise<Installation> => {
		let teamId: string | undefined;
		if (installQuery.isEnterpriseInstall && installQuery.enterpriseId !== undefined) {
			logger.info(`[LOOKUP] org wide app ${installQuery.enterpriseId}`);
			teamId = installQuery.enterpriseId;
		}
		if (installQuery.teamId !== undefined) {
			logger.info(`[LOOKUP] single team app ${installQuery.teamId}`);
			teamId = installQuery.teamId;
		}

		if (teamId) {
			const result = await installService.findOne(teamId);
			if (!result) {
				throw new Error('Failed fetching installation');
			}
			logger.info(`[LOOKUP]  ${teamId}.`);
			if (!result.isEnabled) {
				throw new Error(
					`This instance of pointdPal is not enabled Team [${result.teamId}], Customer [${result.customerId}]`, //, Subscription [${result.subscriptionId}], Status [${result.subscriptionStatus}]`,
				);
			}
			return result.installation;
		}

		throw new Error('Failed fetching installation, failed overall');
	},
	deleteInstallation: async (installQuery: InstallationQuery<boolean>): Promise<void> => {
		let teamId: string | undefined;
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
