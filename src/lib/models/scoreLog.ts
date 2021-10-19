import { Schema, Document, Model, Connection } from 'mongoose';

export interface IScoreLog extends Document {
    from: string;
    to: string;
    date: Date;
    room: string;
    reason: string;
    scoreChange: number;
}

export const ScoreLogSchema = new Schema({
  from: String,
  to: String,
  room: String,
  reason: String,
  date: {
    type: Date,
    default: new Date()
  },
  scoreChange: Number
});



export interface ScoreLogInterface extends IScoreLog {
// instance methods
}

export interface ScoreLogInterfaceModelInterface extends Model<ScoreLogInterface> {
  // static methods
}

export const ScoreLog = (conn: Connection) => conn.model<ScoreLogInterface, ScoreLogInterfaceModelInterface>("scoreLog", ScoreLogSchema);

