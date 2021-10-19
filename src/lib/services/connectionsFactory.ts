import { Helpers } from "../helpers";

const mongoose = require('mongoose');

const procVars = Helpers.getProcessVariables(process.env);

export function connectionFactory(teamId: string) {
  console.log(procVars, procVars.MONGO_URI);
  const connectionUri = procVars.MONGO_URI.replace('#TEAM_ID', teamId);
  const conn = mongoose.createConnection(`${connectionUri}`);
  
  conn.model('User', require('../schemas/user'));
  conn.model('PageView', require('../schemas/pageView'));
  return conn; 
};