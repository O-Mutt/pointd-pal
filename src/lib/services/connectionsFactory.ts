import { Helpers } from '../helpers';

import mongoose from 'mongoose';

const procVars = Helpers.getProcessVariables(process.env);

export function connectionFactory(teamId?: string): mongoose.Connection {
  const connectionUri = procVars.mongoUri.replace('#TEAM_ID', teamId || procVars.defaultDb);
  console.log(procVars.mongoUri);
  const conn = mongoose.createConnection(`${connectionUri}`);
  return conn;
}
