import { load } from '../config';
import postgres, { Sql } from 'postgres';

const config = load();

const connections: { [key: string]: Sql } = {};
export async function connectionFactory(teamId?: string): Promise<Sql> {
  if (!teamId) {
    if (connections[config.defaultDatabaseName]) {
      return connections[config.defaultDatabaseName];
    }
    return (connections[config.defaultDatabaseName] = postgres({ database: config.defaultDatabaseName }));
  }

  if (connections[teamId]) {
    return connections[teamId];
  }

  await connections[config.defaultDatabaseName]`CREATE DATABASE IF NOT EXISTS ${teamId}`;

  return (connections[teamId] = postgres({
    database: teamId,
  }));
}
