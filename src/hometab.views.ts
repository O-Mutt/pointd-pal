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

    const errors: { [blockId: string]: string; } = {};
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
            if (textInputValue) {
              let lowerCaseRoomName = textInputValue.toLowerCase();
              if (lowerCaseRoomName.indexOf('#') === 0) {
                lowerCaseRoomName.substring(1, lowerCaseRoomName.length);
              }
            }
            qrafty.notificationRoom = textInputValue;
            break;
          }
          case blocks.hometab.admin.basic.falsePositiveNotificationChannel: {
            if (textInputValue) {
              let lowerCaseRoomName = textInputValue.toLowerCase();
              if (lowerCaseRoomName.indexOf('#') === 0) {
                lowerCaseRoomName.substring(1, lowerCaseRoomName.length);
              }
            }
            qrafty.falsePositiveRoom = textInputValue;
            break;
          }
          case blocks.hometab.admin.basic.scoreboardChannel: {
            if (textInputValue) {
              let lowerCaseRoomName = textInputValue.toLowerCase();
              if (lowerCaseRoomName.indexOf('#') === 0) {
                lowerCaseRoomName.substring(1, lowerCaseRoomName.length);
              }
            }
            qrafty.scoreboardRoom = textInputValue;
            break;
          }
          case blocks.hometab.admin.basic.formalPraiseUrl: {
            qrafty.formalFeedbackUrl = textInputValue;
            break;
          }
          case blocks.hometab.admin.basic.formalPraiseMod: {
            const modulo = parseInt(textInputValue, 10);
            if (isNaN(modulo)) {
              errors[blocks.hometab.admin.basic.formalPraiseMod, 'Formal praise increment must be a number'];
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
            if (!textInputValue || textInputValue.length === 0) {
              bonusly.url = undefined;
            } else {
              try {
                if (textInputValue.charAt(textInputValue.length - 1) === '/') {
                  textInputValue = textInputValue.substring(0, textInputValue.length - 1);
                }
                bonusly.url = new URL(textInputValue);
              } catch (e) {
                errors[blocks.hometab.admin.bonusly.apiUrl, 'The Bonusly API Url is invalid.'];
                logger.warn('There was an error thrown when trying to set the bonusly url');
              }
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

    if (Object.keys(errors).length > 0) {
      await ack({
        response_action: 'errors',
        errors: errors
      });
      return;
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

    const errors: { [blockId: string]: string; } = {};
    for (const option in view.state.values) {
      for (const key in view.state.values[option]) {
        const value: string = (view.state.values[option][key].value ||
          view.state.values[option][key].selected_option?.value) as string;
        switch (key) {
          case blocks.hometab.user.bonusly.prompt: {
            user.bonuslyPrompt = value;
            break;
          }
          case blocks.hometab.user.bonusly.scoreOverride: {
            const parsedOverride = parseInt(value, 10);
            if (isNaN(parsedOverride)) {
              errors[blocks.hometab.user.bonusly.scoreOverride] = 'The score override must be a number.';
            }
            user.bonuslyScoreOverride = parsedOverride;
            break;
          }
          case blocks.hometab.user.bonusly.pointsDm: {
            user.bonuslyPointsDM = value === EnabledSettings.ENABLED;
            break;
          }
          case blocks.hometab.user.qrypto.walletAddress: {
            if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
              errors[blocks.hometab.user.qrypto.walletAddress] = 'Your wallet address is invalid.';
            }
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

    if (Object.keys(errors).length > 0) {
      await ack({
        response_action: 'errors',
        errors: errors
      });
      return;
    }
    user.updatedAt = new Date();
    user.updatedBy = user.slackId;
    logger.debug(`Updating user configs for ${teamId} by ${userId}`);
    await user.save();
  },
);