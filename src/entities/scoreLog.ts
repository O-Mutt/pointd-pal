export class ScoreLog {
  from: string;
  to: string;
  date: Date;
  channel: string;
  scoreChange: number;
  reason?: string;

  static async getCreateTableQuery() {
    return [
      `
    CREATE TABLE IF NOT EXISTS score_log (
      id SERIAL PRIMARY KEY,
      from_user TEXT NOT NULL,
      to_user TEXT NOT NULL,
      channel TEXT NOT NULL,
      reason TEXT,
      date TIMESTAMP NOT NULL DEFAULT NOW(),
      score_change INTEGER NOT NULL
    );
  `,
      `
    CREATE INDEX IF NOT EXISTS score_log_to_from_date_idx
    ON score_log (to_user, from_user, date DESC);
  `,
    ];
  }
}
