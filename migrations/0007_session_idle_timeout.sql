-- Add a rolling last-activity timestamp for server-enforced idle expiry.
ALTER TABLE sessions ADD COLUMN last_seen_at TEXT;
UPDATE sessions SET last_seen_at = created_at WHERE last_seen_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_last_seen ON sessions(last_seen_at);
