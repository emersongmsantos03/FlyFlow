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
  revoked_at TEXT
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
