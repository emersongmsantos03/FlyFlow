-- Histórico de toda escrita feita por token na API de dados.
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
