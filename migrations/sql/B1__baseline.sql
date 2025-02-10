--  Since psql 13 we shouldn't need this extension
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
--
--
-- installs
CREATE TABLE installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id VARCHAR(255) NOT NULL,
  team_name VARCHAR(255) NULL,
  customer_id VARCHAR(255) NULL,
  is_enterprise BOOLEAN NOT NULL DEFAULT false,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  installation jsonb NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by VARCHAR(255) NULL,
  updated_at TIMESTAMPTZ NOT NULL default now(),
  updated_by VARCHAR(255) NULL
);

-- team_id must be unique
CREATE UNIQUE INDEX idx_installations_unique_team_id ON installations(team_id);

CREATE INDEX idx_installations_customer_id ON installations(customer_id);

CREATE INDEX idx_installations_team_id_customer_id ON installations(team_id, customer_id);

--
--
-- bot tokens
CREATE TABLE bot_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled BOOLEAN NOT NULL,
  name VARCHAR(255) NOT NULL,
  public_wallet_address VARCHAR(255) NOT NULL,
  token INTEGER NOT NULL,
  magic_string VARCHAR(255) NOT NULL
);

--
--
-- configs
CREATE TABLE configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- should these be room id or name?
  notification_room VARCHAR(255) NULL,
  -- should these be room id or name?
  false_positive_room VARCHAR(255) NULL,
  scoreboard_room VARCHAR(255) NULL,
  formal_feedback_url VARCHAR(255) NULL,
  formal_feedback_modulo INTEGER NOT NULL DEFAULT 10,
  reasons_keyword VARCHAR(255) NULL,
  company_name VARCHAR(255) NULL,
  -- admins used to be here
  -- pointd_pal_admins
  token_ledger_balance INTEGER NOT NULL DEFAULT 0
);

--
--
-- score logs
CREATE TABLE score_logs (
  "from" VARCHAR(255) NOT NULL,
  "to" VARCHAR(255) NOT NULL,
  "date" TIMESTAMPTZ NOT NULL,
  channel_id VARCHAR(255) NOT NULL,
  channel_name VARCHAR(255) NULL,
  score_change INT NOT NULL,
  reason VARCHAR(255) NULL
);

CREATE INDEX idx_score_logs_from_idx ON score_logs("from");

CREATE INDEX idx_score_logs_to_idx ON score_logs("to");

CREATE INDEX idx_score_logs_date_idx ON score_logs("date");

CREATE INDEX idx_score_logs_channel_idx ON score_logs("channel_id");

CREATE INDEX idx_score_logs_to_from ON score_logs("to", "from");

CREATE INDEX idx_score_logs_from_to ON score_logs("from", "to");

CREATE INDEX idx_score_logs_to_from_date ON score_logs("to", "from", "date");

--
--
-- users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slack_id VARCHAR(255) NOT NULL,
  score INT NOT NULL DEFAULT 0,
  reasons jsonb NOT NULL default '{}',
  points_given jsonb NOT NULL default '{}',
  pointd_pal_day timestamptz NOT NULL default now(),
  account_level INT NOT NULL DEFAULT 1,
  total_points_given INT NOT NULL DEFAULT 0,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  is_bot BOOLEAN NOT NULL DEFAULT false,
  token INT NOT NULL DEFAULT 0,
  email VARCHAR(255) NULL,
  "name" VARCHAR(255) NULL,
  wallet_address VARCHAR(255) NULL,
  updated_at timestamptz NOT NULL default now(),
  updated_by VARCHAR(255) NOT NULL
);

CREATE INDEX idx_slack_id ON users(slack_id);