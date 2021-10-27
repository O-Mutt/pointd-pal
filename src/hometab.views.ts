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
  async (args: SlackViewMiddlewareArgs<ViewSubmitAction> & AllMiddlewareArgs) => {
    await args.ack();
    const teamId = args.context.teamId;
    const userId = args.body.user.id;
    const connection = connectionFactory(teamId);
    const bonusly = await BonuslyBotConfig(connection).findOneOrCreate();
    const qrafty = await QraftyConfig(connection).findOneOrCreate();
    for (const option in args.view.state.values) {
      for (const key in args.view.state.values[option]) {
        const value: string = (args.view.state.values[option][key].value ||
          args.view.state.values[option][key].selected_option?.value) as string;
        switch (key) {
          case 'hometab_qraftyCompanyName': {
            qrafty.companyName = value;
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
              args.logger.warn('There was an error thrown when trying to set the bonusly url');
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
            args.logger.debug('key not recognized');
            break;
          }
        }
      }
    }

    qrafty.updatedBy = userId;
    qrafty.updatedAt = new Date();
    qrafty.bonuslyConfig = bonusly;
    args.logger.debug(`Updating admin configs for ${teamId} by ${userId}`);
    await qrafty.save();
  },
);

app.view(
  actions.hometab.user_settings_submit,
  async (args: SlackViewMiddlewareArgs<ViewSubmitAction> & AllMiddlewareArgs) => {
    await args.ack();
    const teamId = args.context.teamId;
    const userId = args.body.user.id;

    const connection = connectionFactory(teamId);
    const user = await User(connection).findOneBySlackIdOrCreate(userId);

    for (const option in args.view.state.values) {
      for (const key in args.view.state.values[option]) {
        const value: string = (args.view.state.values[option][key].value ||
          args.view.state.values[option][key].selected_option?.value) as string;
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
            args.logger.debug('key not recognized');
            break;
          }
        }
      }
    }
    user.updatedAt = new Date();
    args.logger.debug(`Updating user configs for ${teamId} by ${userId}`);
    await user.save();
  },
);