CREATE TABLE score_log (
  "from" VARCHAR(255) NOT NULL,
  "to" VARCHAR(255) NOT NULL,
  "date" TIMESTAMPTZ NOT NULL,
  channel VARCHAR(255) NOT NULL,
  score_change INT NOT NULL,
  reason VARCHAR(255) NULL
);

CREATE INDEX idx_score_log_from_idx ON score_log("from");

CREATE INDEX idx_score_log_to_idx ON score_log("to");

CREATE INDEX idx_score_log_date_idx ON score_log("date");

CREATE INDEX idx_score_log_channel_idx ON score_log("channel");

CREATE INDEX idx_score_log_to_from ON score_log("to", "from");

CREATE INDEX idx_score_log_from_to ON score_log("from", "to");

CREATE INDEX idx_score_log_to_from_date ON score_log("to", "from", "date");