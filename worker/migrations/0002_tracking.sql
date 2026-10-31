-- Links curtos dos e-mails, eventos de e-mail e cliques do site.
-- Tokens antigos recebem só `metrics`: permissões novas são concedidas por token.

ALTER TABLE integration_tokens ADD COLUMN scopes TEXT NOT NULL DEFAULT 'metrics';

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
