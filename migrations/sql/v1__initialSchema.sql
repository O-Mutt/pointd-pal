CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE bot_tokens (
  id UUID PRIMARY KEY,
  enabled BOOLEAN NOT NULL,
  name VARCHAR(255) NOT NULL,
  public_wallet_address VARCHAR(255) NOT NULL,
  token INTEGER NOT NULL,
  magic_string VARCHAR(255) NOT NULL
);

CREATE TABLE installation (
  id UUID PRIMARY KEY,
  team_id NOT NULL string,
  customer_id NOT NULL string,
  is_enterprise: boolean NOT NULL DEFAULT false,
  is_enabled: boolean NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now,
  created_by UUID NULL,
  updated_at TIMESTAMPTZ NOT NULL default now,
  updated_by UUID NULL
);

CREATE INDEX idx_installation_team_id ON installation(team_id);

CREATE INDEX idx_installation_customer_id ON installation(customer_id);

CREATE INDEX idx_installation_team_id_customer_id ON installation(team_id, customer_id);