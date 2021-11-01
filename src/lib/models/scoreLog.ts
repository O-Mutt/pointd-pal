import { Schema, Document, Model, Connection } from 'mongoose';

export interface IScoreLog extends Document {
  from: string;
  to: string;
  date: Date;
  channel: string;
  reason: string;
  scoreChange: number;
}

export const ScoreLogSchema = new Schema({
  from: String,
  to: String,
  channel: String,
  reason: String,
  date: {
    type: Date,
    default: new Date(),
    index: -1
  },
  scoreChange: Number,
});

ScoreLogSchema.index({ to: 1, from: 1, date: -1 });

export interface ScoreLogInterface extends IScoreLog {
  // instance methods
}

export interface ScoreLogInterfaceModelInterface extends Model<ScoreLogInterface> {
  // static methods
}

export const ScoreLog = (conn: Connection) =>
  conn.model<ScoreLogInterface, ScoreLogInterfaceModelInterface>('scoreLog', ScoreLogSchema);
