# SPORE BET

SPORE BET is a Cloudflare-hosted sportsbook platform under development for Uganda / East Africa, with country-by-country expansion planned.

## Customer-facing status

- Demo credits, virtual wallets, sample fixtures and demo bet placement have been removed from the customer-facing application.
- Customer wagering, deposits and withdrawals are disabled.
- No payment provider is represented as connected merely because merchant details or API secret names exist.
- The public site must not collect or advertise customer deposits until payment contracts, provider adapters, verified callbacks, cash accounting and compliance controls are operational.

## Target platform

- Cloudflare Pages and Pages Functions for the PWA and API.
- Cloudflare D1 for identity, betting and financial records.
- Cloudflare R2 for approved private documents.
- Cloudflare Queues for provider events, retries and settlement work.
- Cloudflare Cron for reconciliation and operational checks.

See [Real-Money Architecture](docs/REAL_MONEY_ARCHITECTURE.md) for the target service design, cash ledger, provider lifecycles, sports settlement, security model and release gates.

## Mandatory release conditions

Real-money launch is blocked until jurisdiction-specific legal/licensing approval, age and identity verification, AML/fraud controls, responsible-play safeguards, signed payment-provider onboarding, live licensed sports data and results, append-only double-entry cash ledger, provider reconciliation, maker-checker finance operations, independent penetration testing, disaster-recovery evidence and documented operational approval are complete.

A Cloudflare setting or administrator toggle must never bypass these conditions. Provider credentials belong in Cloudflare Secrets, not source code or browser-visible configuration.
