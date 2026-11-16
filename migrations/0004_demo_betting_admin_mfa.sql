-- Persistent demo betting and administrator TOTP MFA.
ALTER TABLE sessions ADD COLUMN admin_mfa_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN totp_secret_encrypted TEXT;
ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bets ADD COLUMN idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bets_user_idempotency ON bets(user_id, idempotency_key);

-- Controlled illustrative markets only. These fixtures have no cash value.
INSERT OR IGNORE INTO events (id, sport_id, competition, home_name, away_name, starts_at, status, provider, provider_event_id)
VALUES
 ('demo-football-event','football','SPORE demo','Kampala City','Nairobi United',datetime('now','+1 day'),'scheduled','spore-demo','football-001'),
 ('demo-basketball-event','basketball','SPORE demo','Kampala Hoops','Nairobi Flyers',datetime('now','+1 day'),'scheduled','spore-demo','basketball-001'),
 ('demo-tennis-event','tennis','SPORE demo','Player A','Player B',datetime('now','+1 day'),'scheduled','spore-demo','tennis-001'),
 ('demo-rugby-event','rugby','SPORE demo','East Lions','Lake Warriors',datetime('now','+1 day'),'scheduled','spore-demo','rugby-001');

INSERT OR IGNORE INTO markets (id,event_id,name,status)
VALUES
 ('demo-football-market','demo-football-event','Match Result','open'),
 ('demo-basketball-market','demo-basketball-event','Match Winner','open'),
 ('demo-tennis-market','demo-tennis-event','Match Winner','open'),
 ('demo-rugby-market','demo-rugby-event','Match Winner','open');

INSERT OR IGNORE INTO selections (id,market_id,name,odds_decimal,status)
VALUES
 ('demo-football-home','demo-football-market','Home',1.82,'open'),
 ('demo-football-draw','demo-football-market','Draw',3.25,'open'),
 ('demo-football-away','demo-football-market','Away',4.10,'open'),
 ('demo-basketball-home','demo-basketball-market','Team A',1.74,'open'),
 ('demo-basketball-away','demo-basketball-market','Team B',1.95,'open'),
 ('demo-tennis-home','demo-tennis-market','Team A',1.88,'open'),
 ('demo-tennis-away','demo-tennis-market','Team B',1.92,'open'),
 ('demo-rugby-home','demo-rugby-market','Team A',1.90,'open'),
 ('demo-rugby-away','demo-rugby-market','Team B',1.90,'open');
