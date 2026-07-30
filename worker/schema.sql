CREATE TABLE IF NOT EXISTS workspaces (
  workspace_id TEXT PRIMARY KEY,
  owner_uid TEXT NOT NULL,
  state_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_state_chunks (
  workspace_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  PRIMARY KEY (workspace_id, chunk_index),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(workspace_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS memberships (
  user_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  email TEXT NOT NULL,
  profile_json TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS memberships_email_idx ON memberships(email);

CREATE TABLE IF NOT EXISTS invitations (
  email TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  profile_json TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
