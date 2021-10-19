import { Helpers } from "../helpers";

const mongoose = require('mongoose');

const procVars = Helpers.getProcessVariables(process.env);
export function connectionFactory(teamId: string) {
  const conn = mongoose.createConnection(`${procVars.MONGODB_URI}/${teamId}`);
  
  conn.model('User', require('../schemas/user'));
  conn.model('PageView', require('../schemas/pageView'));
  return conn; 
};