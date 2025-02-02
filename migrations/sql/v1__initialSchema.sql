CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE bot_token (
  id SERIAL PRIMARY KEY,
  enabled BOOLEAN NOT NULL,
  name VARCHAR(255) NOT NULL,
  public_wallet_address VARCHAR(255) NOT NULL,
  token INTEGER NOT NULL,
  magic_string VARCHAR(255) NOT NULL
);