-- One-time first administrator bootstrap guard.
CREATE TABLE IF NOT EXISTS admin_bootstrap (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  consumed_at TEXT,
  consumed_by TEXT
);
INSERT OR IGNORE INTO admin_bootstrap (id, consumed_at, consumed_by)
VALUES (1, NULL, NULL);
