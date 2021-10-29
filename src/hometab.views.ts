import { AllMiddlewareArgs, SlackViewMiddlewareArgs, ViewSubmitAction } from '@slack/bolt';

import { app } from '../app';
import { BonuslyBotConfig } from './lib/models/bonusly';
import { QraftyConfig } from './lib/models/qraftyConfig';
import { User } from './lib/models/user';
import { connectionFactory } from './lib/services/connectionsFactory';
import { actions } from './lib/types/Actions';
import { EnabledSettings } from './lib/types/Enums';

app.view(
  actions.hometab.admin_settings_submit,
  async ({ ack, context, body, logger, view }: SlackViewMiddlewareArgs<ViewSubmitAction> & AllMiddlewareArgs) => {
    await ack();
    const teamId = context.teamId;
    const userId = body.user.id;
    const connection = connectionFactory(teamId);
    const bonusly = await BonuslyBotConfig(connection).findOneOrCreate();
    const qrafty = await QraftyConfig(connection).findOneOrCreate(teamId as string);
    for (const option in view.state.values) {
      for (const key in view.state.values[option]) {
        const state = view.state.values[option][key];
        const value = (state.value || state.selected_option?.value) as string;
        const selectedUsers = state.selected_users as string[];
        switch (key) {
          case 'hometab_qraftyCompanyName': {
            qrafty.companyName = value;
            break;
          }
          case 'hometab_qraftyAdmins': {
            qrafty.qraftyAdmins = selectedUsers;
            for (const newAdminId of selectedUsers) {
              console.log(newAdminId);
              const user = await User(connection).findOneBySlackIdOrCreate(teamId, newAdminId);
              user.isAdmin = true;
              await user.save();
            }
            break;
          }
          case 'hometab_qraftyNotifications': {
            qrafty.notificationRoom = value.toLowerCase();
            break;
          }
          case 'hometab_qraftyFalsePositiveRoom': {
            qrafty.falsePositiveRoom = value.toLowerCase();
            break;
          }
          case 'hometab_bonuslyEnabled': {
            bonusly.enabled = value === EnabledSettings.ENABLED;
            break;
          }
          case 'hometab_bonuslyUri': {
            try {
              bonusly.url = new URL(value);
            } catch (e) {
              logger.warn('There was an error thrown when trying to set the bonusly url');
            }
            break;
          }
          case 'hometab_bonuslyAPIKey': {
            bonusly.apiKey = value;
            break;
          }
          case 'homeTab_qraftyTokenEnabled': {
            qrafty.qryptoEnabled = value === EnabledSettings.ENABLED;
            break;
          }
          default: {
            logger.debug('key not recognized');
            break;
          }
        }
      }
    }

    qrafty.updatedBy = userId;
    qrafty.updatedAt = new Date();
    qrafty.bonuslyConfig = bonusly;
    logger.debug(`Updating admin configs for ${teamId} by ${userId}`);
    await qrafty.save();
  },
);

app.view(
  actions.hometab.user_settings_submit,
  async ({ ack, context, body, logger, view }: SlackViewMiddlewareArgs<ViewSubmitAction> & AllMiddlewareArgs) => {
    await ack();
    const teamId = context.teamId;
    const userId = body.user.id;

    const connection = connectionFactory(teamId);
    const user = await User(connection).findOneBySlackIdOrCreate(teamId, userId);

    for (const option in view.state.values) {
      for (const key in view.state.values[option]) {
        const value: string = (view.state.values[option][key].value ||
          view.state.values[option][key].selected_option?.value) as string;
        switch (key) {
          case 'hometab_bonuslyPrompt': {
            user.bonuslyPrompt = value;
            break;
          }
          case 'hometab_bonuslyScoreOverride': {
            user.bonuslyScoreOverride = parseInt(value, 10);
            break;
          }
          case 'hometab_cryptoWalletAddress': {
            user.walletAddress = value;
          }
          default: {
            logger.debug('key not recognized');
            break;
          }
        }
      }
    }
    user.updatedAt = new Date();
    logger.debug(`Updating user configs for ${teamId} by ${userId}`);
    await user.save();
  },
);