PRAGMA foreign_keys = ON;

-- SPORE BET initial D1 schema.
-- Real-money wagering remains disabled until legal, licensing, payment,
-- KYC/AML, age-verification and responsible-gambling controls are approved.

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO app_settings (setting_key, setting_value)
VALUES
  ('real_money_enabled', 'false'),
  ('demo_mode_enabled', 'true'),
  ('default_currency', 'UGX');

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  country_code TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','suspended','closed')),
  email_verified_at TEXT,
  phone_verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS wallets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_type TEXT NOT NULL CHECK (wallet_type IN ('demo','cash')),
  currency TEXT NOT NULL,
  balance_minor INTEGER NOT NULL DEFAULT 0 CHECK (balance_minor >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','frozen','closed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, wallet_type, currency)
);

CREATE TABLE IF NOT EXISTS wallet_ledger (
  id TEXT PRIMARY KEY,
  wallet_id TEXT NOT NULL REFERENCES wallets(id),
  entry_type TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  direction TEXT NOT NULL CHECK (direction IN ('credit','debit')),
  reference TEXT UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ledger_wallet_created ON wallet_ledger(wallet_id, created_at);

CREATE TABLE IF NOT EXISTS sports (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  sport_id TEXT NOT NULL REFERENCES sports(id),
  competition TEXT,
  home_name TEXT NOT NULL,
  away_name TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','live','finished','cancelled','suspended')),
  provider TEXT,
  provider_event_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(provider, provider_event_id)
);
CREATE INDEX IF NOT EXISTS idx_events_sport_start ON events(sport_id, starts_at);

CREATE TABLE IF NOT EXISTS markets (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','suspended','settled','void')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS selections (
  id TEXT PRIMARY KEY,
  market_id TEXT NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  odds_decimal REAL NOT NULL CHECK (odds_decimal > 1.0),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','won','lost','void','suspended'))
);

CREATE TABLE IF NOT EXISTS bets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  wallet_id TEXT NOT NULL REFERENCES wallets(id),
  bet_type TEXT NOT NULL DEFAULT 'single' CHECK (bet_type IN ('single','multiple')),
  stake_minor INTEGER NOT NULL CHECK (stake_minor > 0),
  combined_odds REAL NOT NULL CHECK (combined_odds > 1.0),
  potential_return_minor INTEGER NOT NULL CHECK (potential_return_minor >= 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','won','lost','void','cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  settled_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_bets_user_created ON bets(user_id, created_at);

CREATE TABLE IF NOT EXISTS bet_legs (
  id TEXT PRIMARY KEY,
  bet_id TEXT NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
  selection_id TEXT NOT NULL REFERENCES selections(id),
  odds_at_placement REAL NOT NULL CHECK (odds_at_placement > 1.0),
  result TEXT NOT NULL DEFAULT 'pending'
    CHECK (result IN ('pending','won','lost','void'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
