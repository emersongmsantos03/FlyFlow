-- Retrato completo do banco, para consulta. Em banco existente use worker/migrations.
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
-- Métricas ficam fora do snapshot do workspace de propósito: a rotina externa
-- grava a qualquer hora e não pode alterar `workspaces.updated_at`, senão toda
-- sessão aberta do FlyFlow receberia conflito de versão ao salvar.

CREATE TABLE IF NOT EXISTS metric_points (
  workspace_id TEXT NOT NULL,
  source TEXT NOT NULL,
  account TEXT NOT NULL DEFAULT '',
  metric TEXT NOT NULL,
  date TEXT NOT NULL,
  value REAL NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, source, account, metric, date)
);
CREATE INDEX IF NOT EXISTS metric_points_range_idx ON metric_points(workspace_id, date);

CREATE TABLE IF NOT EXISTS metric_posts (
  workspace_id TEXT NOT NULL,
  source TEXT NOT NULL,
  account TEXT NOT NULL DEFAULT '',
  external_id TEXT NOT NULL,
  content_id TEXT,
  title TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  format TEXT NOT NULL DEFAULT '',
  thumbnail_url TEXT NOT NULL DEFAULT '',
  published_at TEXT,
  metrics_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, source, account, external_id)
);
CREATE INDEX IF NOT EXISTS metric_posts_published_idx ON metric_posts(workspace_id, published_at);

CREATE TABLE IF NOT EXISTS integration_connections (
  workspace_id TEXT NOT NULL,
  source TEXT NOT NULL,
  account TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ok',
  last_sync_at TEXT,
  last_error TEXT,
  PRIMARY KEY (workspace_id, source, account)
);

CREATE TABLE IF NOT EXISTS integration_tokens (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  label TEXT NOT NULL,
  prefix TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at TEXT,
  scopes TEXT NOT NULL DEFAULT 'metrics'
);
CREATE INDEX IF NOT EXISTS integration_tokens_workspace_idx ON integration_tokens(workspace_id);

CREATE TABLE IF NOT EXISTS integration_runs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  source TEXT NOT NULL,
  account TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  points_count INTEGER NOT NULL DEFAULT 0,
  posts_count INTEGER NOT NULL DEFAULT 0,
  message TEXT NOT NULL DEFAULT '',
  agent TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS integration_runs_recent_idx ON integration_runs(workspace_id, created_at);

CREATE TABLE IF NOT EXISTS tracked_links (
  code TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  destination_url TEXT NOT NULL,
  campaign TEXT NOT NULL DEFAULT '',
  email_step TEXT NOT NULL DEFAULT '',
  segment TEXT NOT NULL DEFAULT '',
  lead_id TEXT,
  lead_email TEXT NOT NULL,
  button TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS tracked_links_workspace_idx ON tracked_links(workspace_id, created_at);

CREATE TABLE IF NOT EXISTS tracking_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  type TEXT NOT NULL,
  external_id TEXT,
  tracked_link_code TEXT,
  lead_id TEXT,
  lead_email TEXT,
  campaign TEXT NOT NULL DEFAULT '',
  email_step TEXT NOT NULL DEFAULT '',
  segment TEXT NOT NULL DEFAULT '',
  is_bot INTEGER NOT NULL DEFAULT 0,
  ip_hash TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  occurred_at TEXT NOT NULL,
  processed_at TEXT
);
CREATE INDEX IF NOT EXISTS tracking_events_date_idx ON tracking_events(workspace_id, occurred_at);
CREATE INDEX IF NOT EXISTS tracking_events_lead_idx ON tracking_events(workspace_id, lead_id);
CREATE INDEX IF NOT EXISTS tracking_events_email_idx ON tracking_events(workspace_id, lead_email);
CREATE INDEX IF NOT EXISTS tracking_events_pending_idx ON tracking_events(workspace_id, processed_at);
CREATE UNIQUE INDEX IF NOT EXISTS tracking_events_external_idx ON tracking_events(workspace_id, external_id) WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS data_api_audit (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  token_id TEXT NOT NULL,
  action TEXT NOT NULL,
  section TEXT NOT NULL,
  record_id TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_data_api_audit_workspace ON data_api_audit (workspace_id, created_at DESC);
