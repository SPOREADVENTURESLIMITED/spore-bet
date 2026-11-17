-- Cash wallet and auditable manual transaction workflow.
-- Provider automation remains disabled until a signed provider adapter is configured.
CREATE TABLE IF NOT EXISTS cash_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  wallet_id TEXT NOT NULL REFERENCES wallets(id),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('deposit','withdrawal')),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','paid','failed')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('airtel_money','mtn_momo','bank')),
  external_reference TEXT,
  idempotency_key TEXT NOT NULL,
  admin_note TEXT,
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, transaction_type, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_cash_tx_user_created ON cash_transactions(user_id,created_at);
CREATE INDEX IF NOT EXISTS idx_cash_tx_status_created ON cash_transactions(status,created_at);
