import { app } from '@/app';
import { installService } from '@/lib/services';

import type { IInstallation } from '@/models';
import type { Installation, InstallationQuery, InstallationStore, Logger } from '@slack/bolt';

export class PointdPalInstallationStore implements InstallationStore {
	async storeInstallation<AuthVersion extends 'v1' | 'v2'>(
		storeInstall: Installation<AuthVersion, boolean>,
		logger?: Logger,
	): Promise<void> {
		logger?.info('storing installation');
		let teamId: string | undefined;
		let teamName: string | undefined;
		let email: string | undefined;

		if (storeInstall.isEnterpriseInstall && storeInstall.enterprise !== undefined) {
			logger?.info(`org wide ${storeInstall.enterprise.id}`);
			teamId = storeInstall.enterprise.id;
			teamName = storeInstall.enterprise.name;
		}

		if (storeInstall.team !== undefined) {
			logger?.info(`single team ${storeInstall.team.id}`);
			teamId = storeInstall.team.id;
			teamName = storeInstall.team.name;
		}

		logger?.info('checking the bot token');
		if (storeInstall.bot?.token) {
			logger?.info('fetching user info with bot token');
			const { user } = await app.client.users.info({
				token: storeInstall.bot.token,
				user: storeInstall.user.id,
			});
			email = user?.profile?.email;
		}

		let install: IInstallation | null;
		if (teamId) {
			install = await installService.findOne(teamId);
			if (install) {
				await installService.deleteOne(teamId);
			}

			await installService.create(teamId, storeInstall, email ?? `someRando@${teamName}.com`);

			return;
		}
		throw new Error('Failed saving installation data to installationStore');
	}

	async fetchInstallation(fetchInstallQuery: InstallationQuery<boolean>, logger?: Logger) {
		let teamId: string | undefined;
		logger?.info('fetching installation');
		if (fetchInstallQuery.isEnterpriseInstall && fetchInstallQuery.enterpriseId !== undefined) {
			logger?.info(`org wide app ${fetchInstallQuery.enterpriseId}`);
			teamId = fetchInstallQuery.enterpriseId;
		}
		if (fetchInstallQuery.teamId !== undefined) {
			logger?.info(`single team app ${fetchInstallQuery.teamId}`);
			teamId = fetchInstallQuery.teamId;
		}

		if (teamId) {
			logger?.info(`found team id, find an install now by team id ${teamId}`);
			const result = await installService.findOne(teamId);
			if (!result) {
				throw new Error('Failed fetching installation');
			}
			logger?.info(`Found installation for ${teamId}.`, result);
			if (!result.isEnabled) {
				throw new Error(
					`This instance of pointdPal is not enabled for team [${result.teamId}], customer [${result.customerId}]`, //, Subscription [${result.subscriptionId}], Status [${result.subscriptionStatus}]`,
				);
			}
			logger?.info('returning installation');
			return result.installation;
		}

		throw new Error('Failed fetching installation, failed overall');
	}

	async deleteInstallation(deleteQuery: InstallationQuery<boolean>, logger?: Logger) {
		logger?.info('deleting installation', deleteQuery.teamId);
		let teamId: string | undefined;
		if (deleteQuery.isEnterpriseInstall && deleteQuery.enterpriseId !== undefined) {
			teamId = deleteQuery.enterpriseId;
		}
		if (deleteQuery.teamId !== undefined) {
			teamId = deleteQuery.teamId;
		}

		if (teamId) {
			await installService.deleteOne(teamId);
		}
		throw new Error('Failed to delete installation');
	}
}

export const pointdPalInstallationStore = new PointdPalInstallationStore();
