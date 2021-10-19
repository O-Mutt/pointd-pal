import { Helpers } from "../helpers";

const mongoose = require('mongoose');

const procVars = Helpers.getProcessVariables(process.env);

export function connectionFactory(teamId: string) {
  const connectionUri = procVars.mongoUri.replace('#TEAM_ID', teamId);
  const conn = mongoose.createConnection(`${connectionUri}`);
  return conn; 
};