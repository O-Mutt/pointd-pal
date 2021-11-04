export const blocks = {
  hometab: {
    admin: {
      basic: {
        admins: 'hometab-a-qrafty-admins',
        companyName: 'hometab-a-company-name',
        notificationChannel: 'hometab-a-notif-channel',
        falsePositiveNotificationChannel: 'hometab-a-false-notif-channel',
        scoreboardChannel: 'hometab-a-scoreboard-channel',
        formalPraiseUrl: 'hometab-a-formal-url',
        formalPraiseMod: 'hometab-a-formal-mod',
      },
      bonusly: {
        enabled: 'hometab-a-bon-enabled',
        apiUrl: 'hometab-a-bon-url',
        apiKey: 'hometab-a-bon-key',
        defaultReason: 'hometab-a-bon-reason',
        defaultHashtag: 'hometab-a-bon-hash',
      },
      qrypto: {
        enabled: 'hometab-a-qrypto-enabled'
      }
    },
    user: {
      bonusly: {
        pointsDm: 'hometab-u-bonusly-pointsDM',
        scoreOverride: 'hometab-u-bonusly-scoreOverride',
        prompt: 'hometab-u-bonusly-prompt',
      },
      qrypto: {
        walletAddress: 'hometab-u-qrypto-wallet'
      }
    }
  },
  shortcuts: {
    message: {
      recipients: 'shortcut-message-recipients',
      operator: 'shortcuts-message-operator',
      reason: 'shortcuts-message-reason'
    }
  }
};