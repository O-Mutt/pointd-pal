import { AllMiddlewareArgs, directMention, SlackEventMiddlewareArgs } from '@slack/bolt';


import { DatabaseService } from './lib/services/database';
const { scoresDocumentName } = require('./lib/data/scores');
import { Helpers } from './lib/helpers';

import { app } from '../app';
import { Db } from 'mongodb';
import { Member } from '@slack/web-api/dist/response/UsersListResponse';
const procVars = Helpers.getProcessVariables(process.env);

app.message('try to map all slack users to db users', mapUsersToDb);
  
// we should use `directMention() once the code "works"
app.message(/try to map more data to all slack users to db users/, mapMoreUserFieldsBySlackId);
app.message( /try to map @.* to db users/, mapSingleUserToDb);
app.message(/unmap all users/, unmapUsersToDb);
app.message(/map all slackIds to slackEmail/, mapSlackIdToEmail);

const ALLOWED_ADMIN_IDS = [ 'ULKF78MG9', 'UD46NSKSM', 'U0231VDAB1B']

async function mapUsersToDb({ message, context, client, logger, say }) {
  if (!ALLOWED_ADMIN_IDS.includes(message.user)) {
    logger.error('sorry, can\'t do that', message, context);
    await say(`Sorry, can\'t do that https://i.imgur.com/Gp6wNZr.gif <@${message.user}>`);
    return;
  }
  const databaseService = new DatabaseService({ ...procVars });
  await databaseService.init();
  const db = await databaseService.getDb() as Db;

  const members = (await client.users.list()).members as Member[] ;

  const mappings: string[] = [];
  for (const member of members) {
    try {
      logger.debug('Map this member', JSON.stringify(member));
      const localMember = await databaseService.getUser(member.name);
      localMember.slackId = member.id;
      if (localMember._id) {
        await db.collection(scoresDocumentName).replaceOne({ name: localMember.name }, localMember);
        mappings.push(`\`{ name: ${localMember.name}, slackId: ${localMember.slackId}, id: ${localMember._id} }\``);
      }
      logger.debug(`Save the new member ${JSON.stringify(localMember)}`);
    } catch (er) {
      logger.error('failed to find', member, er);
    }
  }
  await say(`Ding fries are done. We mapped ${mappings.length} of ${members.length} users. \n${mappings.join('\n')}`);
}

async function mapMoreUserFieldsBySlackId({ message, context, client, logger, say }) {
  if (!ALLOWED_ADMIN_IDS.includes(message.user)) {
    logger.error('sorry, can\'t do that', message, context);
    await say(`Sorry, can\'t do that https://i.imgur.com/Gp6wNZr.gif <@${message.user}>`);
    return;
  }
  const databaseService = new DatabaseService({ ...procVars });
  await databaseService.init();
  const db = await databaseService.getDb() as Db;

  const { members } = await client.users.list();
  for (const member of members) {
    if (member.profile.email) {
      try {
        logger.debug('Map this member', JSON.stringify(member));
        const localMember = await databaseService.getUser(member);
        localMember.slackId = member.id;
        localMember.slackEmail = member.profile.email;
        if (localMember._id) {
          await db.collection(scoresDocumentName).replaceOne({ slackId: localMember.slackId }, localMember);
        }
        logger.debug(`Save the new member ${JSON.stringify(localMember)}`);
      } catch (er) {
        logger.error('failed to find', member, er);
      }
    }
  }
  await say('Ding fries are done.');
}

async function mapSingleUserToDb({ message, context, client, logger, say }) {
  if (!ALLOWED_ADMIN_IDS.includes(message.user)) {
    logger.error('sorry, can\'t do that', message, context);
    await say(`Sorry, can\'t do that https://i.imgur.com/Gp6wNZr.gif <@${message.user}>`);
    return;
  }

  logger.debug(context);
  const { mentions } = context;
  if (!mentions) {
    await say('You need to @ someone to map.');
    return;
  }
  const userMentions = mentions.filter((men) => men.type === 'user');
  if (userMentions > 1) {
    userMentions.shift(); // shift off @hubot
  }
  const to = userMentions.shift();
  const databaseService = new DatabaseService({ ...procVars });
  await databaseService.init();
  const db = await databaseService.getDb() as Db;


  const { user } = await client.users.info({ user: to.id });

  try {
    logger.debug('Map this member', JSON.stringify(user));
    const localMember = await databaseService.getUser(user);
    localMember.slackId = user.id;
    // eslint-disable-next-line no-underscore-dangle
    if (localMember._id) {
      await db.collection(scoresDocumentName).replaceOne({ name: localMember.name }, localMember);
      await say(`Mapping completed for ${to.name}: { name: ${localMember.name}, slackId: ${localMember.slackId}, id: ${localMember._id} }`);
      return;
    }
    logger.debug(`Save the new member ${JSON.stringify(localMember)}`);
  } catch (er) {
    logger.error('failed to find', user, er);
  }
}

async function unmapUsersToDb({ message, context, logger, say }) {
  if (!ALLOWED_ADMIN_IDS.includes(message.user)) {
    logger.error('sorry, can\'t do that', message, context);
    await say(`Sorry, can\'t do that https://i.imgur.com/Gp6wNZr.gif <@${message.user}>`);
    return;
  }
  const databaseService = new DatabaseService({ ...procVars });
  await databaseService.init();

  try {
    const db = await databaseService.getDb() as Db;
    await db.collection(scoresDocumentName).updateMany({}, { $unset: { slackId: 1 } });
  } catch (er) {
    logger.error('failed to unset all slack ids', er);
  }
  await say('Ding fries are done. We unmapped all users');
}

async function mapSlackIdToEmail({message, context, logger, say, client}) {
  if (!ALLOWED_ADMIN_IDS.includes(message.user)) {
    logger.error('sorry, can\'t do that', message, context);
    await say(`Sorry, can\'t do that https://i.imgur.com/Gp6wNZr.gif <@${message.user}>`);
    return;
  }

  const databaseService = new DatabaseService({ ...procVars });
  await databaseService.init();
  const db = await databaseService.getDb() as Db;

  try {
    const missingEmailUsers = await db.collection(scoresDocumentName).find({ slackId: { $exists: true }, slackEmail: { $exists: false } }).toArray();

    for (const user of missingEmailUsers) {
      logger.debug('Map this member', user.slackId, user.name);
      let slackUser;
      try {
        slackUser = (await client.users.info({ user: user.slackId })).user;
      } catch (e) {
        logger.error(`error retrieving user: ${user.slackId} ${user.name}`);
      }
      if (slackUser.profile && slackUser.profile.email) {
        user.slackEmail = slackUser.profile.email;
        await db.collection(scoresDocumentName).replaceOne({ slackId: user.slackId }, user);
      }
      await say(`Mapping completed for ${user.name}: { name: ${user.name}, slackId: <@${user.slackId}>, email: ${user.slackEmail} }`);
    }
  } catch (er) {
    logger.error('Error processing users', er);
  }
}