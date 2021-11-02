import { AllMiddlewareArgs, SlackViewMiddlewareArgs, ViewSubmitAction } from '@slack/bolt';
import { ESMap } from 'typescript';

import { app } from '../app';
import { BonuslyConfig } from './lib/models/bonuslyConfig';
import { QraftyConfig } from './lib/models/qraftyConfig';
import { User } from './lib/models/user';
import { connectionFactory } from './lib/services/connectionsFactory';
import { actions } from './lib/types/Actions';
import { blocks } from './lib/types/BlockIds';
import { EnabledSettings } from './lib/types/Enums';

app.view(
  actions.hometab.admin_settings_submit,
  async ({ ack, context, body, logger, view }: SlackViewMiddlewareArgs<ViewSubmitAction> & AllMiddlewareArgs) => {
    await ack();
    const teamId = context.teamId as string;
    const userId = body.user.id;


    const connection = connectionFactory(teamId);
    const bonusly = await BonuslyConfig(connection).findOneOrCreate();
    const qrafty = await QraftyConfig(connection).findOneOrCreate(teamId as string);

    const errors: ESMap<string, string> = new Map();
    for (const option in view.state.values) {
      for (const key in view.state.values[option]) {
        const state = view.state.values[option][key];
        let textInputValue = state.value as string;
        switch (key) {
          case blocks.hometab.admin.basic.admins: {
            const selectedUsers = state.selected_users as string[];
            qrafty.qraftyAdmins = selectedUsers;
            for (const newAdminId of selectedUsers) {
              console.log(newAdminId);
              const user = await User(connection).findOneBySlackIdOrCreate(teamId, newAdminId);
              user.isAdmin = true;
              await user.save();
            }
            break;
          }
          case blocks.hometab.admin.basic.companyName: {
            qrafty.companyName = textInputValue;
            break;
          }
          case blocks.hometab.admin.basic.notificationChannel: {
            let lowerCaseRoomName = textInputValue.toLowerCase();
            if (lowerCaseRoomName.indexOf('#') === 0) {
              lowerCaseRoomName.substring(1, lowerCaseRoomName.length);
            }
            qrafty.notificationRoom = textInputValue.toLowerCase();
            break;
          }
          case blocks.hometab.admin.basic.falsePositiveNotificationChannel: {
            let lowerCaseRoomName = textInputValue.toLowerCase();
            if (lowerCaseRoomName.indexOf('#') === 0) {
              lowerCaseRoomName.substring(1, lowerCaseRoomName.length);
            }
            qrafty.falsePositiveRoom = textInputValue.toLowerCase();
            break;
          }
          case blocks.hometab.admin.basic.scoreboardChannel: {
            let lowerCaseRoomName = textInputValue.toLowerCase();
            if (lowerCaseRoomName.indexOf('#') === 0) {
              lowerCaseRoomName.substring(1, lowerCaseRoomName.length);
            }
            qrafty.scoreboardRoom = textInputValue.toLowerCase();
            break;
          }
          case blocks.hometab.admin.basic.formalPraiseUrl: {
            qrafty.formalFeedbackUrl = textInputValue;
            break;
          }
          case blocks.hometab.admin.basic.formalPraiseMod: {
            const modulo = parseInt(textInputValue, 10);
            if (isNaN(modulo)) {
              errors.set(blocks.hometab.admin.basic.formalPraiseMod, 'Formal praise increment must be a number');
            }
            qrafty.formalFeedbackModulo = modulo;
            break;
          }
          case blocks.hometab.admin.bonusly.enabled: {
            const selectedOption = state.selected_option?.value as string;
            bonusly.enabled = selectedOption === EnabledSettings.ENABLED;
            break;
          }
          case blocks.hometab.admin.bonusly.apiUrl: {
            try {
              if (textInputValue.charAt(textInputValue.length - 1) === '/') {
                textInputValue = textInputValue.substring(0, textInputValue.length - 1);
              }
              bonusly.url = new URL(textInputValue);
            } catch (e) {
              errors.set(blocks.hometab.admin.bonusly.apiUrl, 'The Bonusly API Url is invalid.');
              logger.warn('There was an error thrown when trying to set the bonusly url');
            }
            break;
          }
          case blocks.hometab.admin.bonusly.apiKey: {
            if (textInputValue.indexOf('*') === -1) {
              bonusly.apiKey = textInputValue;
            }
            break;
          }
          case blocks.hometab.admin.bonusly.defaultReason: {
            bonusly.defaultReason = textInputValue;
            break;
          }
          case blocks.hometab.admin.bonusly.defaultHashtag: {
            bonusly.defaultHashtag = textInputValue;
            break;
          }
          case blocks.hometab.admin.qrypto.enabled: {
            const selectedOption = state.selected_option?.value as string;
            qrafty.qryptoEnabled = selectedOption === EnabledSettings.ENABLED;
            break;
          }
          default: {
            logger.debug(`key not recognized: ${key}`);
            break;
          }
        }
      }
    }

    qrafty.updatedBy = userId;
    qrafty.updatedAt = new Date();
    qrafty.bonuslyConfig = bonusly;
    logger.debug(`Updating admin configs for ${teamId} by ${userId}`);
    await bonusly.save();
    await qrafty.save();
  },
);

app.view(
  actions.hometab.user_settings_submit,
  async ({ ack, context, body, logger, view }: SlackViewMiddlewareArgs<ViewSubmitAction> & AllMiddlewareArgs) => {
    await ack();
    const teamId = context.teamId as string;
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
          case 'hometab_bonuslyPointsDM': {
            user.bonuslyPointsDM = value === EnabledSettings.ENABLED;
            break;
          }
          case 'hometab_cryptoWalletAddress': {
            user.walletAddress = value;
            break;
          }
          default: {
            logger.debug(`key not recognized: ${key}`);
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