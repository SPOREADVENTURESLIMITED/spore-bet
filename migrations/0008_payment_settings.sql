-- Administrator-editable payment destination details. These are display-only
-- instructions; they do not activate deposits, withdrawals or real-money play.
CREATE TABLE IF NOT EXISTS payment_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  airtel_merchant TEXT NOT NULL DEFAULT '',
  mtn_merchant TEXT NOT NULL DEFAULT '',
  bank_name TEXT NOT NULL DEFAULT '',
  bank_account_number TEXT NOT NULL DEFAULT '',
  bank_branch TEXT NOT NULL DEFAULT '',
  bank_swift TEXT NOT NULL DEFAULT '',
  updated_by TEXT REFERENCES users(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO payment_settings
  (id, airtel_merchant, mtn_merchant, bank_name, bank_account_number, bank_branch, bank_swift)
VALUES
  (1, '4320455', '26555826', 'EQUITY', '1051103138923', 'KAMPALA', 'EQBLUGKA');
