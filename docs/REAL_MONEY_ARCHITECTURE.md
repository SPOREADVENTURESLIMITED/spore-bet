# SPORE BET — Real-Money Betting Architecture

**Status:** Target architecture defined; implementation and release approvals remain open.
**Current operating mode:** Demo-only. This document does not authorize real-money wagering.
**Platform:** Cloudflare Pages + Pages Functions + D1; R2 and Queues for approved future workflows.
**Initial market design:** Uganda / East Africa, with country-by-country expansion.

> A UI switch or database flag must never activate real-money betting. Cash operations remain blocked until licensing, provider approval, compliance, accounting, security and operational release gates are signed off.

## 1. Operating modes

- **Demo mode (current):** virtual credits only; no cash value, deposits, withdrawals or conversion to money.
- **Regulated cash mode (future):** isolated cash wallet, verified payment rails, licensed sports/odds sources, server-authoritative betting and settlement, KYC/age/AML, responsible-play controls, finance operations and regulatory reporting.

Demo and cash balances must never be combined or transferred between one another. Demo transactions must never enter cash accounting. Cash availability must be determined server-side from the verified country, licence, account status and release controls.

## 2. Logical architecture

```text
Customer PWA / Web App             Administrator Console
          | HTTPS                         | MFA + RBAC
          +---------------+---------------+
                          |
                Cloudflare Pages
                Pages Functions API
                          |
       +------------------+-------------------+
       |                  |                   |
 Identity & Access    Betting Domain      Money Domain
 sessions / MFA       events / markets    payment intents
 roles / KYC          quotes / bet slips  provider adapters
 rate limits          placement / grading cash ledger / payouts
       |                  |                   |
       +------------------+-------------------+
                          |
                Cloudflare D1 (system of record)
                          |
             +------------+-------------+
             |                          |
     Approved sports data        Approved payment rails
     fixtures / odds / results    MTN / Airtel / bank / card

R2: private documents and reports, where approved
Queues: provider events, retries and settlement jobs
Cron: reconciliation, provider health and reporting
```

D1 is authoritative for account, bet and ledger state. Provider responses are external evidence, not direct authority to mutate balances. Queue consumers must be idempotent. No provider secret or privileged API call may run in the browser.

## 3. Core services

| Service | Responsibility |
|---|---|
| Identity | Secure passwords and sessions, MFA, account status, device/session revocation |
| Jurisdiction | Country resolution, licence availability, permitted products and geofencing |
| KYC / age | Identity and legal-age checks through an approved vendor |
| AML / fraud | Risk scoring, screening where required, velocity rules and escalation |
| Responsible play | Deposit/stake/loss/time limits, cooling-off, self-exclusion and intervention |
| Sports catalogue | Licensed fixtures, markets, participants and provider event mapping |
| Odds service | Server-side odds snapshots, quote expiry and provider provenance |
| Bet engine | Validate account, jurisdiction, event, market, odds, limits and funds |
| Settlement | Grade authorized results; handle voids, corrections and disputes |
| Wallet / ledger | Append-only double-entry journal, available/reserved balances and reconciliation |
| Payment orchestration | Provider collection/disbursement adapters, verified webhooks and idempotency |
| Administration | Least-privilege roles, MFA, maker-checker approvals and immutable audit |
| Reporting | Finance reconciliation, responsible-play events, tax/fees and regulatory reports |

## 4. Cash wallet and accounting

All amounts use integer minor units and an explicit ISO currency. Never use floating-point arithmetic for money. Each wallet is scoped to one customer, wallet type and currency. Demo and cash wallets are separate.

The cash ledger must be append-only and double-entry. Each posted journal balances to zero per currency. Corrections use compensating journal entries; posted entries are never edited or deleted.

Required accounting concepts:
- Customer available balance and reserved balance (open bets and pending withdrawals).
- Payment clearing/provider receivable, payout payable, sportsbook liability and settlement accounts.
- Fees, refunds, chargebacks and adjustments.
- Journal, journal lines, external reference, idempotency key and reconciliation status.

A wallet balance is a projection of posted ledger entries, not a freely editable number. Every balance mutation and its journal must commit atomically. Enforce unique idempotency keys and unique provider transaction/event IDs. Reject duplicate, stale, mismatched-currency and out-of-order events.

## 5. Payment lifecycle

Potential payment channels, subject to provider contracts and country availability:
- MTN Mobile Money collection and disbursement.
- Airtel Money collection and disbursement.
- Approved bank transfer / bank API.
- Approved card acquirer / hosted checkout.

Provider availability, country, currency, merchant identifiers, fees, limits and API credentials are environment-specific. Do not assume one provider's API shape or credentials work for another. Credentials belong in Cloudflare Secrets, never D1 plaintext, Git, browser code, logs or public payment settings. Non-secret merchant display destinations may be stored as editable configuration.

### Deposit flow
1. Customer passes country, account, age/KYC, AML and limit checks.
2. API creates a pending payment intent with a unique idempotency key and expected currency/amount.
3. Server creates the provider collection request using server-held credentials.
4. Provider callback is authenticated, timestamp/replay checked and matched against intent, amount, currency and merchant.
5. Server independently queries provider transaction status where supported. Browser redirect or customer screenshot is never proof of payment.
6. One atomic journal posts clearing debit and customer wallet credit; payment intent becomes settled.
7. Duplicate callbacks return the prior result; mismatches go to an exception queue, never customer credit.
8. Provider statement reconciliation identifies missing, duplicate and mismatched records.

### Withdrawal flow
1. Customer passes identity, destination ownership, AML, risk and withdrawal-limit checks.
2. Funds move atomically from available to reserved; request enters pending review.
3. High-risk or policy-triggered requests require a second authorized administrator's maker-checker approval.
4. Payout is initiated through the approved provider adapter with a unique idempotency key.
5. Only independently verified provider success posts final ledger entries and marks paid.
6. Failure or rejection releases the reservation exactly once. Ambiguous status remains under investigation and must not be retried blindly.
7. All actions, operator identities, references and timestamps are audited.

Manual bank/mobile-money processing, if legally and contractually allowed, uses the same intent, verification, dual-control, ledger and reconciliation rules. An administrator clicking approve is not proof that funds arrived; clicking paid is not proof a payout was sent.

## 6. Betting and settlement lifecycle

1. Licensed feed adapter imports events and markets with provider ID, timestamp and provenance.
2. Market is unavailable by default until event mapping, start time, rules and provider status pass validation.
3. Odds service creates a short-lived server-side quote. Client-submitted odds are informational only.
4. Bet placement rechecks country, account, age/KYC, self-exclusion, limits, event/market status, quote expiry, current price and available cash.
5. One atomic transaction reserves stake, persists bet and legs, records odds snapshot, appends balanced journal, writes audit and enqueues required work. If any step fails, no money/bet state is committed.
6. A confirmed receipt is returned only after commit. Repeated requests with the same idempotency key return the original receipt.
7. Results arrive from an authorized provider. Settlement validates provenance and market-specific rules, then posts payout/refund journal entries once.
8. Corrections use explicit resettlement workflows and compensating journals; historical outcomes are not silently overwritten.
9. Disputes and manual overrides require reason, evidence, privileged authorization and immutable audit.

No bet is accepted after market suspension, event start, quote expiry, account block or limit breach. Provider outages fail closed: no fabricated fixtures, odds, scores or settlement decisions.

## 7. Administrator control plane

The dashboard must provide country/jurisdiction enablement with licence evidence; provider status and reconciliation health; non-secret merchant configuration and secret-presence indicators; deposit/withdrawal queues and exceptions; KYC/AML case status; customer limits and self-exclusion; market suspension and settlement exceptions; immutable audit and finance reports.

Privileged access requires MFA, short-lived revocable sessions and least-privilege roles: support, finance maker, finance checker, risk/compliance, operations and owner. Maker-checker separation applies to manual credits, withdrawals, refunds, adjustments and sensitive settings. Sensitive actions require step-up authentication. One administrator cannot approve their own high-risk payout or ledger adjustment.

## 8. Target data model

Existing demo tables remain demo-scoped. Future cash-domain migrations require reviewed tables for:
- `jurisdictions`, `licence_evidence`, `country_product_rules`
- `customer_verifications`, `verification_events`, `risk_cases`
- `responsible_play_limits`, `self_exclusions`, `cooling_off_periods`
- `payment_provider_configs` (non-secret metadata), `payment_intents`, `provider_events`
- `withdrawal_requests`, `payout_attempts`, `reconciliation_batches`, `reconciliation_items`
- `cash_accounts`, `ledger_journals`, `ledger_lines`
- `odds_snapshots`, `bet_quotes`, `cash_bets`, `cash_bet_legs`
- `settlement_runs`, `settlement_items`, `bet_adjustments`
- `admin_approvals`, `audit_logs`, `outbox_events`

Every table needs foreign keys, indexes, status constraints, currency fields, timestamps and retention policy. Enforce uniqueness for idempotency and external event identifiers. Migrations must be backward-compatible, tested against a restored copy and applied through the reviewed GitHub Actions / Wrangler D1 migration process. Do not add cash tables or change production flags as a substitute for implementation and review.

## 9. API contract boundaries

Future versioned, server-authoritative resource groups:
- `/api/v1/identity/*`, `/api/v1/verification/*`
- `/api/v1/wallets`, `/api/v1/wallets/:id/ledger`
- `/api/v1/payment-intents`, `/api/v1/withdrawals`
- `/api/v1/events`, `/api/v1/markets`, `/api/v1/quotes`
- `/api/v1/bets`, `/api/v1/bets/:id`
- `/api/v1/admin/providers`, `/api/v1/admin/reconciliation`, `/api/v1/admin/approvals`

Every state-changing request requires authentication, authorization, CSRF/origin protection, schema validation, rate limiting, idempotency and audit. Webhooks use provider authentication, strict payload limits, replay protection and event deduplication. Responses must not disclose credentials, internal risk rules or other customers' information.

## 10. Cloudflare responsibilities

| Component | Intended use |
|---|---|
| Pages + Functions | Customer/admin frontend and API edge runtime |
| D1 | Transactional relational source of truth; atomic batches and constraints |
| R2 | Private KYC evidence and statements, with access controls and lifecycle rules |
| Queues | Webhook inbox, payment retries, settlement and notification jobs |
| Cron Triggers | Reconciliation, provider health, expiry and reporting |
| Secrets | Provider credentials, webhook secrets and encryption keys |
| Turnstile / rate limits | Abuse reduction on public entry points |
| Logs / alerts | Operational observability with sensitive-data redaction |

Use separate staging and production environments and separate provider sandbox credentials. Production secrets must not be copied to preview. Backups, restore testing, retention, access review and incident response are mandatory. Load-test D1 write concurrency and transaction semantics; if projected ledger throughput exceeds the validated D1 envelope, select an appropriately regulated transactional datastore before taking customer funds.

## 11. Security, privacy and resilience

- TLS in transit, encryption at rest, key rotation and least-privilege secret access.
- Strong password hashing, Secure/HttpOnly/SameSite cookies, CSRF controls, session expiry and revocation.
- MFA and role-based authorization for every admin endpoint.
- Parameterized SQL, strict schemas, output encoding, CSP/security headers and dependency scanning.
- Webhook signature verification, replay protection, idempotency, provider status inquiry and dead-letter handling.
- Rate limits and abuse detection for login, verification, deposits, withdrawals and bet placement.
- Minimize personal data; define lawful basis, notices, retention, access, correction and deletion processes.
- Incident response for account takeover, payment compromise, provider outage, data breach and erroneous settlement.
- Independent penetration test, secure code review, restore rehearsal, load test and operational runbooks before launch.

## 12. Mandatory release gates

Production cash release is blocked until every item is evidenced:
1. Written local legal assessment and required licence/approval for each country and product; regulator conditions mapped to controls.
2. Signed merchant/acquirer contracts, production credentials, approved callbacks, settlement statements and provider certification.
3. Approved KYC/age vendor, identity and destination checks, AML workflows where required, and trained case handling.
4. Limits, self-exclusion, cooling-off, intervention, complaints and support processes tested end to end.
5. Double-entry ledger implemented, independent accounting review, reconciliation and chargeback/refund workflows tested.
6. Licensed live data and odds agreement, event/market mapping, price freshness and authorized result/settlement source.
7. Independent penetration test with critical/high findings closed; secrets, MFA, RBAC and webhook controls verified.
8. Backup restore and full-service disaster recovery rehearsal with approved RPO/RTO.
9. Monitoring, alerting, support, dispute, incident, fraud and regulatory reporting runbooks staffed.
10. Sandbox end-to-end tests for deposits, duplicate callbacks, under/overpayment, failed/ambiguous payout, duplicate bet, odds change, suspended market, void, correction, self-exclusion and limit breach.

Until legal, compliance, finance, security and business owners sign off these gates, `real_money_enabled` must remain false and cash bet placement, deposit crediting and payouts must fail closed.

## 13. Current repository reality

The repository contains a demo sportsbook and preliminary cash transaction/admin scaffolding. The current `cash_transactions` workflow records requests and manual reviews; it is not proof of a connected MTN, Airtel, bank or card payment API. The cash branch in the existing bet handler is not a complete regulated betting service: a setting check and wallet debit do not provide jurisdiction, KYC/AML, responsible-play, provider odds, result settlement, double-entry accounting, provider reconciliation or independent approval.

Payment setup notes list candidate environment variable names, but documentation does not mean a provider is connected or certified. Existing demo and cash-related code must be reviewed and hardened against this target before production cash activation. Do not accept real customer funds while this distinction remains.

## 14. Definition of architecture completion

The target design is complete when system boundaries, authoritative data ownership, cash accounting, provider lifecycles, bet/settlement lifecycle, admin controls, security controls, Cloudflare responsibilities and release gates are specified. Implementation, provider onboarding, licensing and independent verification are separate delivery stages and must not be reported as complete merely because this document is committed.