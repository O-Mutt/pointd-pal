import { Md } from 'slack-block-builder';

import { directMention } from '@slack/bolt';
import { Member } from '@slack/web-api/dist/response/UsersListResponse';

import { app } from '../app';
import { Helpers } from './lib/helpers';
import { IUser, User } from './lib/models/user';
import { connectionFactory } from './lib/services/connectionsFactory';
import { DatabaseService } from './lib/services/database';

const procVars = Helpers.getProcessVariables(process.env);

// we should use `directMention() once the code "works"
app.message('try to map all slack users to db users', directMention(), mapUsersToDb);
app.message('try to map more data to all slack users to db users', directMention(), mapMoreUserFieldsBySlackId);
app.message('try to map @.* to db users', directMention(), mapSingleUserToDb);
app.message('unmap all users', directMention(), unmapUsersToDb);
app.message('map all slackIds to slackEmail', directMention(), mapSlackIdToEmail);

const ALLOWED_ADMIN_IDS = ['ULKF78MG9', 'UD46NSKSM', 'U0231VDAB1B'];

async function mapUsersToDb({ message, context, client, logger, say }) {
  if (!ALLOWED_ADMIN_IDS.includes(message.user)) {
    logger.error("sorry, can't do that", message, context);
    await say(`Sorry, can\'t do that https://i.imgur.com/Gp6wNZr.gif ${Md.user(message.user)}`);
    return;
  }
  const teamId = context.teamId;
  const databaseService = new DatabaseService({ ...procVars });

  const members: Member[] = (await client.users.list()).members;

  const mappings: string[] = [];
  for (const member of members) {
    try {
      logger.debug('Map this member', JSON.stringify(member));
      const localMember = await databaseService.getUser(teamId, member.id as string);
      mappings.push(`\`{ name: ${localMember.name}, slackId: ${localMember.slackId}, id: ${localMember._id} }\``);
      logger.debug(`Save the new member ${JSON.stringify(localMember)}`);
    } catch (er) {
      logger.error('failed to find', member, er);
    }
  }
  await say(`Ding fries are done. We mapped ${mappings.length} of ${members.length} users. \n${mappings.join('\n')}`);
}

async function mapMoreUserFieldsBySlackId({ message, context, client, logger, say }) {
  if (!ALLOWED_ADMIN_IDS.includes(message.user)) {
    logger.error("sorry, can't do that", message, context);
    await say(`Sorry, can\'t do that https://i.imgur.com/Gp6wNZr.gif ${Md.user(message.user)}`);
    return;
  }
  const databaseService = new DatabaseService({ ...procVars });
  const teamId = context.teamId;

  const members: Member[] = (await client.users.list()).members;
  for (const member of members) {
    if (member?.profile?.email) {
      try {
        logger.debug('Map this member', JSON.stringify(member));
        const localMember = await databaseService.getUser(teamId, member.id as string);
        localMember.slackId = member.id as string;
        localMember.email = member.profile.email;
        await localMember.save();
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
    logger.error("sorry, can't do that", message, context);
    await say(`Sorry, can\'t do that https://i.imgur.com/Gp6wNZr.gif ${Md.user(message.user)}`);
    return;
  }

  logger.debug(context);

  // do the mention dance
  const to = { slackId: 'drp', name: 'derrp' };
  const databaseService = new DatabaseService({ ...procVars });
  const teamId = context.teamId;

  const { user } = await client.users.info({ user: to.slackId });
  try {
    logger.debug('Map this member', JSON.stringify(user));
    const localMember = await databaseService.getUser(teamId, user);
    localMember.slackId = user.slackId;
    // eslint-disable-next-line no-underscore-dangle
    if (localMember._id) {
      await localMember.save();
      await say(
        `Mapping completed for ${to.name}: { name: ${localMember.name}, slackId: ${localMember.slackId}, id: ${localMember._id} }`,
      );
      return;
    }
    logger.debug(`Save the new member ${JSON.stringify(localMember)}`);
  } catch (er) {
    logger.error('failed to find', user, er);
  }
}

async function unmapUsersToDb({ message, context, logger, say }) {
  if (!ALLOWED_ADMIN_IDS.includes(message.user)) {
    logger.error("sorry, can't do that", message, context);
    await say(`Sorry, can\'t do that https://i.imgur.com/Gp6wNZr.gif ${Md.user(message.user)}`);
    return;
  }
  const databaseService = new DatabaseService({ ...procVars });
  const teamId = context.teamId;

  try {
    await User(connectionFactory(teamId))
      .updateMany({}, { $unset: { slackId: 1 } })
      .exec();
  } catch (er) {
    logger.error('failed to unset all slack ids', er);
  }
  await say('Ding fries are done. We unmapped all users');
}

async function mapSlackIdToEmail({ message, context, logger, say, client }) {
  if (!ALLOWED_ADMIN_IDS.includes(message.user)) {
    logger.error("sorry, can't do that", message, context);
    await say(`Sorry, can\'t do that https://i.imgur.com/Gp6wNZr.gif ${Md.user(message.user)}`);
    return;
  }

  const databaseService = new DatabaseService({ ...procVars });
  const teamId = context.teamId;

  try {
    const missingEmailUsers: IUser[] = await User(connectionFactory(teamId))
      .find({ id: { $exists: true }, email: { $exists: false } })
      .exec();

    for (const user of missingEmailUsers) {
      logger.debug('Map this member', user.slackId, user.name);
      let slackUser;
      try {
        slackUser = (await client.users.info({ user: user.slackId })).user;
      } catch (e) {
        logger.error(`error retrieving user: ${user.slackId} ${user.name}`);
      }
      if (slackUser.profile && slackUser.profile.email) {
        user.email = slackUser.profile.email;
        await user.save();
      }
      await say(
        `Mapping completed for ${user.name}: { name: ${user.name}, slackId: ${Md.user(user.slackId)}, email: ${user.email} }`,
      );
    }
  } catch (er) {
    logger.error('Error processing users', er);
  }
}
