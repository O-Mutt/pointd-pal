import { app } from '@/app';
import { type IInstallation } from '@/entities/installation';
import * as installService from '@/lib/services/installService';
import { withNamespace } from '@/logger';
import { type Installation, type InstallationQuery, type InstallationStore } from '@slack/bolt';
import type { UsersInfoResponse } from '@slack/web-api';

const logger = withNamespace('installStore');
export const PointdPalInstallStore: InstallationStore = {
	storeInstallation: async (installation) => {
		const storeLogger = logger.label('storeInstallation');
		let teamId: string | undefined;
		let teamName: string | undefined;
		let email: string | undefined;
		storeLogger.info('storing installation');
		if (installation.isEnterpriseInstall && installation.enterprise !== undefined) {
			storeLogger.info(`org wide ${installation.enterprise.id}`);
			teamId = installation.enterprise.id;
			teamName = installation.enterprise.name;
		}
		if (installation.team !== undefined) {
			storeLogger.info(`single team ${installation.team.id}`);
			teamId = installation.team.id;
			teamName = installation.team.name;
		}

		storeLogger.info('checking the bot token');
		if (installation.bot?.token) {
			storeLogger.info('fetching user info with bot token');
			const { user } = (await app.client.users.info({
				token: installation.bot.token,
				user: installation.user.id,
			})) as UsersInfoResponse;
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
		const fetchLogger = logger.label('fetchInstallation');
		let teamId: string | undefined;
		fetchLogger.info('fetching installation');
		if (installQuery.isEnterpriseInstall && installQuery.enterpriseId !== undefined) {
			fetchLogger.info(`org wide app ${installQuery.enterpriseId}`);
			teamId = installQuery.enterpriseId;
		}
		if (installQuery.teamId !== undefined) {
			fetchLogger.info(`single team app ${installQuery.teamId}`);
			teamId = installQuery.teamId;
		}

		if (teamId) {
			fetchLogger.info(`found team id, find an install now by team id ${teamId}`);
			const result = await installService.findOne(teamId);
			if (!result) {
				throw new Error('Failed fetching installation');
			}
			fetchLogger.info(`Found installation for ${teamId}.`, result);
			if (!result.isEnabled) {
				throw new Error(
					`This instance of pointdPal is not enabled for team [${result.teamId}], customer [${result.customerId}]`, //, Subscription [${result.subscriptionId}], Status [${result.subscriptionStatus}]`,
				);
			}
			fetchLogger.info('returning installation');
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
