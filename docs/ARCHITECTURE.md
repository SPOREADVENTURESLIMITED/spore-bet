# SPORE BET — Official Technical Architecture

**Status:** Deployed demo sportsbook foundation; production wagering is intentionally disabled.  
**Repository:** `SPOREADVENTURESLIMITED/spore-bet`  
**Runtime:** Cloudflare Pages + Pages Functions + Cloudflare D1  
**Public origin:** `https://spore-bet.pages.dev`

## 1. Architecture at a glance

```text
Customer / Administrator browser
  ├── Responsive sportsbook UI (index.html)
  ├── Installable PWA (manifest.webmanifest, sw.js, icons/)
  └── Restricted admin UI (admin.html)
          │ HTTPS / same-origin JSON API
          ▼
Cloudflare Pages Functions (functions/api/)
  ├── Authentication, sessions, password hashing, rate limits
  ├── Customer account and demo wallet
  ├── Events, markets and selections
  ├── Demo bet placement and idempotency
  ├── Administrator overview and TOTP MFA
  └── Health endpoint
          │ D1 binding: DB
          ▼
Cloudflare D1: spore-bet-db
  ├── users / sessions
  ├── wallets / wallet_ledger
  ├── sports / events / markets / selections
  ├── bets / bet_legs
  ├── audit_logs / auth_rate_limits
  └── app_settings / d1_migrations
```

## 2. Runtime components

| Layer | Responsibility | Current implementation |
|---|---|---|
| Web client | Responsive sportsbook and account UX | Static HTML/CSS/JS |
| PWA | Installability and offline shell | Web manifest + service worker |
| Edge/API | Server-side validation and authorization | Cloudflare Pages Functions |
| Persistence | Relational records and migrations | Cloudflare D1 |
| Identity | Password hashing, secure cookie sessions | PBKDF2-SHA-256, hashed random session tokens |
| Admin security | Role checks and TOTP MFA | AES-GCM encrypted TOTP secret; MFA-verified session flag |
| Abuse controls | Authentication throttling | D1-backed rate-limit buckets |
| Audit | Security and business event trail | D1 audit_logs |

## 3. API surface

- `GET /api/health` — service mode and database binding presence.
- `POST /api/auth/register` — customer registration and demo wallet initialization; always assigns the customer role.\n- `POST /api/admin/bootstrap` — one-time first-admin activation gated by a Cloudflare secret, exact allowlisted email, rate limit and D1 one-time guard.
- `POST /api/auth/login` — credential verification, rate limiting, session issue and admin MFA.
- `POST /api/auth/logout` — session revocation.
- `GET /api/auth/me` — current authenticated account.
- `GET /api/sports`, `GET /api/events`, `GET /api/markets` — public demo catalogue.
- `GET /api/bets`, `POST /api/bets` — authenticated demo bet history and placement.
- `GET /api/admin/overview` — admin-only, MFA-verified dashboard data.
- `POST /api/admin/sessions/revoke-all` — MFA-verified revocation of all administrator sessions, including the invoking session.
- `POST /api/admin/mfa/setup`, `POST /api/admin/mfa/verify` — administrator TOTP enrollment.

All cash wagering, deposits, withdrawals, payouts and cash wallet operations remain disabled.

## 4. Identity and authorization model

- New public registrations receive the `customer` role; role is never accepted from public registration input.\n- The first administrator can be created only once through `/api/admin/bootstrap`, requiring `ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_TOKEN` and an unused D1 `admin_bootstrap` guard. The token is one-time and should be removed from Cloudflare after activation.
- Accounts must be active to establish an authenticated session.
- Session cookies are Secure, HttpOnly and SameSite=Lax. Only a SHA-256 token hash is stored in D1. Mutating API requests reject mismatched Origin and cross-site Fetch Metadata. Logout reports success only after a session revocation attempt succeeds. Sessions have a seven-day absolute lifetime and a 30-minute server-enforced idle timeout. Authenticated activity refreshes `last_seen_at`; sessions idle beyond 30 minutes are rejected. The MFA-protected administrator-wide revocation endpoint revokes every active administrator session and clears the invoking cookie.
- Sessions expire after seven days and are revocable.
- Administrator endpoints require an active account with `role='admin'`.
- Admin dashboard data additionally requires a session with `admin_mfa_verified=1`.
- TOTP secrets are encrypted at rest with AES-GCM using the Cloudflare secret `MFA_ENCRYPTION_KEY`.
- D1-backed throttling is applied to registration, login, first-admin bootstrap, and administrator MFA setup/verification attempts.
- Administrative activity is written to the audit log.

## 5. Data and transaction boundaries

- Wallet balances are integer minor units; ledger entries are append-only transaction records.
- Demo signup credits are non-cash and non-withdrawable.
- Demo bets are checked against current open selections, markets, event status and start time on the server.
- Bet placement uses a unique per-user idempotency key and a D1 batch to keep wallet debit, bet, legs, ledger and audit records together.
- Client-provided odds, returns, user IDs and roles are not authoritative.
- Demo fixtures and odds are illustrative and are not a live sports data feed.

## 6. Deployment and migration flow

1. Changes are committed to GitHub and validated by GitHub Actions.
2. The deployment workflow applies pending remote D1 migrations before publishing Pages Functions.
3. Wrangler deploys the repository root as the `spore-bet` Pages project.
4. Cloudflare Pages publishes the production deployment.
5. Verify the public site, `/api/health`, and protected administrator route after every deployment.

Cloudflare project configuration uses `wrangler.toml`, with D1 binding `DB` and database `spore-bet-db`. GitHub deployment secrets must be maintained by the repository administrator: `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

## 7. Explicitly deferred integrations

These are not represented as implemented and must remain disabled until separately designed, approved, configured and tested:

- Live odds and sports data provider, feed licensing, event mapping and settlement authority.
- Payment gateway, merchant/acquirer approval, deposits, withdrawals, refunds and reconciliation.
- KYC, age/identity verification, AML/sanctions screening, fraud detection and transaction monitoring.
- Jurisdiction-specific licensing, legal terms, privacy notices, retention schedules and consumer protection.
- Responsible-gambling controls: limits, cooling-off, self-exclusion, intervention and support workflows.
- Customer notifications (SMS/email/push), support operations and incident escalation.
- Production settlement, dispute management, accounting exports and financial reporting.
- Independent penetration test, privacy review, disaster recovery and operational SLAs.

Do not enable real-money mode by changing a UI flag. A regulated-money architecture requires separate approved backend workflows and controls, not merely a configuration toggle.

## 8. Operating invariants

1. Demo-only mode is the only permitted mode in this deployment.
2. No real payment credentials or live wagering are connected.
3. Never promote an account through public registration or trust client-side role claims.
4. Never expose secrets, password hashes, TOTP seeds, session tokens or payment data in logs or API responses.
5. No real customer money is to be accepted, held, paid or represented by demo credits.
6. Operational details and legal/business decisions remain under the administrator's control.

## 9. Current verification boundary

The live site and health endpoint were reachable during the latest inspection. The health endpoint reported `status=ok`, `mode=demo-only`, `realMoneyEnabled=false`, and `databaseConfigured=true`. An unauthenticated request to `/api/admin/overview` returned HTTP 401, as expected. D1 inspection confirmed migrations 0001–0006 applied in the current production deployment; migration 0007 is proposed in PR #5 and is not active until merged and deployed, no rows from `PRAGMA foreign_key_check`, no duplicate bet idempotency groups, and matching stored demo-wallet balance and net ledger balance. D1 `PRAGMA quick_check` returned `ok`, and `PRAGMA foreign_key_check` returned no rows. The scheduled GitHub Actions backup verification exported production D1, restored the SQL dump into an isolated SQLite database, passed full `PRAGMA integrity_check` (`ok`) and `PRAGMA foreign_key_check` (no rows), verified demo-only mode flags, and reconciled wallet balances to the ledger. A temporary isolated D1 restore was also completed successfully: 88 SQL queries restored 15 tables, D1 quick_check and foreign_key_check passed, demo-only settings and wallet-ledger reconciliation passed, and the temporary database was deleted. Measured full-service RPO/RTO remain unverified.

These checks do not substitute for a signed-in administrator test, full browser regression, external security assessment, legal approval or payment-provider certification.
