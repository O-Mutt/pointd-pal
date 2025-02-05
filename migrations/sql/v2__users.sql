CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slackId VARCHAR(255) PRIMARY KEY,
  scope NUMBER NOT NULL DEFAULT 0,
  reasons jsonb NOT NULL default '{}',
  pointsGiven jsonb NOT NULL default '{}',
  pointdPalDay timestamptz NOT NULL default now(),
  accountLevel NUMBER NOT NULL DEFAULT 1,
  totalPointsGiven NUMBER NOT NULL DEFAULT 0,
  isAdmin BOOLEAN NOT NULL DEFAULT FALSE,
  isBot BOOLEAN NOT NULL DEFAULT FALSE,
  token NUMBER NOT NULL DEFAULT 0,
  email VARCHAR(255) NULL,
  name VARCHAR(255) NULL,
  walletAddress VARCHAR(255) NULL,
  updatedAt timestamptz NOT NULL default now(),
  updatedBy UUID NOT NULL,
  FOREIGN KEY (updatedBy) REFERENCES users(id)
);

CREATE INDEX idx_slackId ON users(slackId);