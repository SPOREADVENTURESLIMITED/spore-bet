# SPORE BET — Current Technical Architecture

**Status:** Customer-facing demo product retired. Real-money launch remains locked.
**Repository:** `SPOREADVENTURESLIMITED/spore-bet`
**Runtime:** Cloudflare Pages + Pages Functions + Cloudflare D1
**Public origin:** `https://spore-bet.pages.dev`

## Current operating state

The customer homepage no longer offers demo credits, illustrative matches, virtual bet slips or demo wallet controls. The legacy demo bet endpoint is retired. Sports and market APIs return no customer-facing catalogue until approved live feeds are connected. Deposits, withdrawals and wagering fail closed.

The existing D1 demo-era records and tables are retained for audit/history and are not offered as spendable customer balances. Do not delete historical financial or audit records as part of UI retirement.

## Runtime components

- Cloudflare Pages: customer site and PWA shell.
- Pages Functions: authenticated API routes and administrative APIs.
- D1 binding `DB`: existing user, session, wallet, bet, market and audit records.
- Cloudflare Secrets: future payment, sports feed and encryption credentials.
- R2 / Queues / Cron: planned for private evidence, provider event processing and reconciliation; not claimed as live integrations.

## API behavior

- `GET /api/health`: reports database health and `mode=real-money-not-launched`.
- `GET /api/auth/me`: returns account identity but no demo wallet balance.
- `GET /api/sports`, `/api/events`, `/api/markets`: return empty catalogues until verified live feeds are implemented.
- `GET /api/bets`: no demo bet history exposed as an active product.
- `POST /api/bets`: returns HTTP 423; wagering is not launched.
- `POST /api/deposits`, `POST /api/withdrawals`: return HTTP 423; no funds are accepted or reserved.
- Administrator APIs remain separately authenticated and MFA-protected.

## Real-money target architecture

See [REAL_MONEY_ARCHITECTURE.md](REAL_MONEY_ARCHITECTURE.md). It defines the future cash ledger, payment provider lifecycle, betting quote and settlement flow, KYC/AML, responsible play, admin maker-checker controls, reconciliation and Cloudflare service boundaries.

## Launch invariants

1. No demo betting or demo credits are available to customers.
2. No real money is accepted, reserved, credited, wagered or paid until the full regulated release is approved.
3. Payment credentials remain in Cloudflare Secrets.
4. Provider callbacks must be authenticated, deduplicated and independently verified before ledger posting.
5. Cash journal entries are append-only, double-entry and balanced per currency.
6. All high-risk manual financial actions require maker-checker approval and immutable audit.
7. Provider outages, missing credentials, unverified callbacks and jurisdiction uncertainty fail closed.
