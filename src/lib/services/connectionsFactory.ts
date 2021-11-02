import { Helpers as H } from '../helpers';

import mongoose from 'mongoose';

const procVars = H.getProcessVariables(process.env);

const connections: { [key: string]: mongoose.Connection } = {};
export function connectionFactory(teamId?: string): mongoose.Connection {
  const databaseName = teamId || procVars.defaultDb || '';
  if (connections[databaseName]) {
    return connections[databaseName];
  }

  const connectionUri = procVars.mongoUri.replace('#TEAM_ID', teamId || procVars.defaultDb || '');
  connections[databaseName] = mongoose.createConnection(`${connectionUri}`);
  connections[databaseName];
  return connections[databaseName];
}
