-- Hashed short-window authentication throttling buckets. No raw IP or identifier is stored.
CREATE TABLE IF NOT EXISTS auth_rate_limits (
  bucket_key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL CHECK (attempts > 0),
  window_started_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_window ON auth_rate_limits(window_started_at);
