import { Helpers } from "../helpers";

const mongoose = require('mongoose');

const procVars = Helpers.getProcessVariables(process.env);

export function connectionFactory(teamId: string) {
  const connectionUri = procVars.mongoUri.replace('#TEAM_ID', teamId);
  const conn = mongoose.createConnection(`${connectionUri}`);
  
  conn.model('User', require('../schemas/user'));
  conn.model('PageView', require('../schemas/pageView'));
  return conn; 
};