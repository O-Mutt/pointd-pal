import { Md } from 'slack-block-builder';

import { AllMiddlewareArgs, directMention, SlackEventMiddlewareArgs } from '@slack/bolt';
import { Member } from '@slack/web-api/dist/response/UsersListResponse';

import { app } from '../app';
import { Helpers as H } from './lib/helpers';
import { IUser, User } from './lib/models/user';
import { connectionFactory } from './lib/services/connectionsFactory';
import { DatabaseService } from './lib/services/database';
import { ConversationsListResponse } from '@slack/web-api';

new DatabaseService();

// we should use `directMention() once the code "works"
app.message('try to map all slack users to db users', directMention(), mapUsersToDb);
app.message('try to map more data to all slack users to db users', directMention(), mapMoreUserFieldsBySlackId);
app.message('try to map @.* to db users', directMention(), mapSingleUserToDb);
app.message('unmap all users', directMention(), unmapUsersToDb);
app.message('map all slackIds to slackEmail', directMention(), mapSlackIdToEmail);
app.message('hubot to bolt', directMention(), migrateFromHubotToBolt);
app.message('join all old qrafty channels', directMention(), joinAllQraftyChannels);

async function mapUsersToDb({ message, context, client, logger, say }) {
  const teamId = context.teamId as string;
  const userId: string = message.user;

  const { isAdmin } = await User(connectionFactory(teamId)).findOneBySlackIdOrCreate(teamId, userId);
  if (!isAdmin) {
    logger.error("sorry, can't do that", message, context);
    await say(`Sorry, can\'t do that https://i.imgur.com/Gp6wNZr.gif ${Md.user(message.user)}`);
    return;
  }

  const members: Member[] = (await client.users.list()).members;

  const mappings: string[] = [];
  for (const member of members) {
    try {
      logger.debug('Map this member', JSON.stringify(member));
      const localMember = await User(connectionFactory(teamId)).findOneBySlackIdOrCreate(teamId, member.id as string);
      mappings.push(`\`{ name: ${localMember.name}, slackId: ${localMember.slackId}, id: ${localMember._id} }\``);
      logger.debug(`Save the new member ${JSON.stringify(localMember)}`);
    } catch (er) {
      logger.error('failed to find', member, er);
    }
  }
  await say(`Ding fries are done. We mapped ${mappings.length} of ${members.length} users. \n${mappings.join('\n')}`);
}

async function mapMoreUserFieldsBySlackId({ message, context, client, logger, say }) {
  const teamId = context.teamId as string;
  const userId: string = message.user;

  const { isAdmin } = await User(connectionFactory(teamId)).findOneBySlackIdOrCreate(teamId, userId);
  if (!isAdmin) {
    logger.error("sorry, can't do that", message, context);
    await say(`Sorry, can\'t do that https://i.imgur.com/Gp6wNZr.gif ${Md.user(message.user)}`);
    return;
  }


  const members: Member[] = (await client.users.list()).members;
  for (const member of members) {
    if (member?.profile?.email) {
      try {
        logger.debug('Map this member', JSON.stringify(member));
        const localMember = await User(connectionFactory(teamId)).findOneBySlackIdOrCreate(teamId, member.id as string);
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
  const teamId = context.teamId as string;
  const userId: string = message.user;

  const { isAdmin } = await User(connectionFactory(teamId)).findOneBySlackIdOrCreate(teamId, userId);
  if (!isAdmin) {
    logger.error("sorry, can't do that", message, context);
    await say(`Sorry, can\'t do that https://i.imgur.com/Gp6wNZr.gif ${Md.user(message.user)}`);
    return;
  }

  logger.debug(context);

  // do the mention dance
  const to = { slackId: 'drp', name: 'derrp' };


  const { user } = await client.users.info({ user: to.slackId });
  try {
    logger.debug('Map this member', JSON.stringify(user));
    const localMember = await User(connectionFactory(teamId)).findOneBySlackIdOrCreate(teamId, user);
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
  const teamId = context.teamId as string;
  const userId: string = message.user;

  const { isAdmin } = await User(connectionFactory(teamId)).findOneBySlackIdOrCreate(teamId, userId);
  if (!isAdmin) {
    logger.error("sorry, can't do that", message, context);
    await say(`Sorry, can\'t do that https://i.imgur.com/Gp6wNZr.gif ${Md.user(message.user)}`);
    return;
  }

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
  const teamId = context.teamId as string;
  const userId: string = message.user;

  const { isAdmin } = await User(connectionFactory(teamId)).findOneBySlackIdOrCreate(teamId, userId);
  if (!isAdmin) {
    logger.error("sorry, can't do that", message, context);
    await say(`Sorry, can\'t do that https://i.imgur.com/Gp6wNZr.gif ${Md.user(message.user)}`);
    return;
  }



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

async function migrateFromHubotToBolt({ message, context, logger, say, client }) {
  const teamId = context.teamId as string;
  const userId: string = message.user;
  const connection = connectionFactory(teamId)
  const { isAdmin } = await User(connection).findOneBySlackIdOrCreate(teamId, userId);
  if (!isAdmin) {
    logger.error("sorry, can't do that", message, context);
    await say(`Sorry, can\'t do that https://i.imgur.com/Gp6wNZr.gif ${Md.user(message.user)}`);
    return;
  }

  try {
    const hubotishUsers: any[] = await User(connection)
      .find({ id: { $exists: true } })
      .exec();

    for (const hubotishUser of hubotishUsers) {
      logger.debug('Map this member', hubotishUser.slackId, hubotishUser.name);
      hubotishUser.qraftyToken = hubotishUser.token || hubotishUser.qraftyToken;
      delete hubotishUser.token;
      hubotishUser.email = hubotishUser.slackEmail || hubotishUser.email;
      delete hubotishUser.slackEmail;
      for (const [key, value] of hubotishUser.pointsGiven) {
        if (isBase64(key)) {
          const decodedPointGiven = decode(key);
          hubotishUser.reasons.set(decodedPointGiven, value);
          console.log("check each point given", key, decodedPointGiven, hubotishUser.pointsGiven[key], hubotishUser.pointsGiven[decodedPointGiven])
          delete hubotishUser.pointsGiven[key];
        } else {
          console.log("point given not base 64", key);
        }
      }
      await say(`Decoding the reasons and the points given finished for ${Md.user(hubotishUser.slackId)}`);
      await User(connection).replaceOne({ slackId: hubotishUser.slackId }, hubotishUser as IUser);
    }
  } catch (er) {
    logger.error('Error processing users', er);
  }
}

async function joinAllQraftyChannels({ say, logger, message, client, context }) {
  let result: ConversationsListResponse | undefined = undefined;
  const teamId = context.teamId as string;
  const oldQrafty = 'U03HDRG36';

  const userId: string = message.user;
  const connection = connectionFactory(teamId)
  const { isAdmin } = await User(connection).findOneBySlackIdOrCreate(teamId, userId);
  if (!isAdmin) {
    logger.error("sorry, can't do that", message, context);
    await say(`Sorry, can\'t do that https://i.imgur.com/Gp6wNZr.gif ${Md.user(message.user)}`);
    return;
  }

  try {
    result = await client.conversations.list({ team_id: teamId });
  } catch (e: any | unknown) {
    // logger.error(e)
    console.error('Error getting list of conversations', e.message);
  }
  if (!result || !result.channels) {
    console.log("could not find conversation list in migration");
    return;
  }

  for (const channel of result.channels) {
    try {
      const { members } = await client.conversations.members({ channel: channel.id as string });
      if (members && members.includes(oldQrafty)) {
        client.conversations.join({ channel: channel.id as string });
      }
    } catch (e) {
      console.error(`There was an error looking up members and joining the channel ${channel.id}`);
    }
  }
}

function decode(str: string): string {
  const buff = Buffer.from(str, 'base64');
  const text = buff.toString('utf-8');
  return text;
}

function encode(str: string): string {
  const buff = Buffer.from(str);
  const base64data = buff.toString('base64');
  return base64data;
}

function isBase64(str: string): boolean {
  try {
    return encode(decode(str)) == str;
  } catch (err) {
    return false;
  }
}