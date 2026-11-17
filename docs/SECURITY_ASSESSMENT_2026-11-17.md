# SPORE BET — Security and Recovery Assessment

**Assessment date:** 17 November 2026  
**Target:** https://spore-bet.pages.dev and SPOREADVENTURESLIMITED/spore-bet  
**Assessment type:** Internal source/configuration review and bounded regression planning. This is not an independent third-party penetration-test certificate.

## Executive result

The application remains **demo-only**. No real-money wagering, deposits, withdrawals, payouts, or payment-provider integrations are enabled. No destructive production test was performed.

The review identified two session-lifecycle gaps: there was no inactivity timeout and no single action to revoke all administrator sessions. Both fixes were merged in PR #5 and deployed to production on 17 November 2026. The mobile overflow found in the first browser run was fixed in PR #6 and the repeat browser matrix passed. Production now enforces a 30-minute idle timeout with a seven-day absolute expiry and provides an MFA-protected organization-wide administrator-session revocation action. The invoking session is revoked and customer sessions are unaffected.

## Scope reviewed

- Pages Functions authentication, session creation/lookup/logout, admin overview and MFA paths.
- Global request middleware and API security headers.
- Demo betting API, D1 schema/migrations, idempotency and wallet/ledger controls.
- Public, admin and money-preview UI paths.
- D1 production database metadata, health/integrity queries, export and Time Travel bookmark access.
- CI validation, CodeQL analysis, Playwright desktop/mobile regression, and post-deploy production smoke checks.

## Evidence and results

| Area | Result | Evidence / limitation |
|---|---|---|
| Administrator authorization | Existing admin overview is role- and MFA-gated | Prior production check: anonymous request returned 401; admin account and MFA were previously verified. |
| Session security | Implemented and deployed | Migration 0007 is applied in production; 30-minute idle expiry, seven-day absolute expiry and MFA-protected all-admin revocation are live. Existing idle sessions older than 30 minutes require re-authentication. |
| API safeguards | Source reviewed; automated regression added | Existing middleware rejects cross-origin state-changing requests and applies security headers. Playwright and post-deploy smoke checks verify headers, cross-site logout rejection, anonymous admin denial and unauthenticated administrator-revocation denial. |
| SQL handling | Source reviewed | Parameterized D1 statements are used in the reviewed authentication and betting paths. |\n| Static analysis | Passed | GitHub CodeQL analysis completed successfully on the production release commit. |
| Browser regression | Passed | Playwright passed on Chromium, Firefox, WebKit, Pixel 7 emulation and iPhone 13 emulation, including mobile overflow, admin access denial, demo-only preview and security-header/CSRF checks. |
| Database quick integrity | Passed | D1 PRAGMA quick_check returned ok; PRAGMA foreign_key_check returned no rows. |
| Full SQLite integrity | Passed on exported restore | GitHub Actions exported production D1, restored the SQL dump into a clean local SQLite database, ran PRAGMA integrity_check = ok and foreign_key_check with no violations. The temporary export and restored database were deleted from the ephemeral runner. |
| D1 export and restore | Passed | Scheduled GitHub Actions exported production D1, restored the dump into isolated SQLite and a temporary D1 database, verified migration 0007, and deleted the temporary database and export files. |
| Point-in-time recovery | Availability confirmed | Database reports version=production; current and prior Time Travel bookmarks were retrievable. No in-place Time Travel rollback was performed against production. The separate SQL export restore into temporary D1 passed. |
| Restore rehearsal / RPO / RTO | SQLite and temporary D1 restore passed; full-service RPO/RTO remain open | The SQL export restored into isolated SQLite and a temporary D1 database. Full SQLite integrity_check returned ok; D1 quick_check and foreign_key_check passed; demo-only flags and wallet/ledger reconciliation passed; the temporary D1 and export files were deleted. RPO/RTO for restoring the whole service, DNS and application deployment remain unmeasured. |
| Independent penetration test | Not completed | Requires an independent security tester with an agreed scope and report. This review must not be represented as third-party certification. |

## Findings and remediation

### SEC-01 — Missing idle-session expiry
**Status:** Remediation proposed in PR #5.  
**Impact:** A valid session could remain usable until its absolute expiry or manual revocation, even after a long idle period.  
**Fix:** Add last_seen_at, initialize it at session creation, update it on authenticated activity, and reject sessions idle for more than 30 minutes. The seven-day absolute lifetime remains.  
**Verification:** Session unit tests passed; production migration 0007 is applied; production session inspection found no missing activity timestamps. Existing sessions older than the idle window were rejected.

### SEC-02 — No administrator-wide session revocation
**Status:** Remediation proposed in PR #5.  
**Impact:** Incident response required individual session revocation or manual database operations.  
**Fix:** Add an MFA-protected endpoint and dashboard control to revoke every active administrator session, including the caller, with an audit event. Customer sessions are not changed.  
**Verification:** Unit tests passed for customer denial, missing-MFA denial and successful atomic D1 revocation/audit batch. Production smoke confirmed unauthenticated revocation is rejected. The live revoke-all control has not been invoked, to avoid signing out all administrators without an incident-response need.

### SEC-03 — Full service recovery objectives not yet measured
**Status:** Data restore verification passed; RPO/RTO measurement remains open.  
**Impact:** The database export and restore path is proven, but end-to-end recovery time for the full application, DNS, secrets, and deployment has not been measured.  
**Evidence:** The automated workflow exported production D1, restored it into isolated SQLite and a temporary D1 database, passed full SQLite integrity_check, D1 quick_check and foreign_key_check, confirmed demo-only settings, reconciled wallet balances to the ledger, and deleted temporary data.  
**Remaining fix:** Conduct a controlled full-service recovery exercise in a separate environment and record RPO/RTO. Never restore over the live production database.

### SEC-04 — Independent penetration test outstanding
**Status:** Open / requires independent assessor.  
**Impact:** No third-party assurance exists for the application or Cloudflare account configuration.  
**Fix:** Commission a scoped assessment covering authentication/MFA, session lifecycle, authorization, CSRF, injection/XSS, API abuse, deployment secrets, data integrity, and PWA caching. Provide the assessor a staging environment and written rules of engagement.

## Safe testing boundaries

- No denial-of-service, credential stuffing, destructive SQL, production restore, real-money transaction, or customer-data mutation tests were performed.
- Do not expose passwords, TOTP secrets, API tokens, session cookies, password hashes, or raw user data in test artifacts.
- Any future provider-controlled event/market data must be rendered as text or safely escaped; the current browser UI fixture strings are static local demo constants.
- Keep real-money features disabled until legal/licensing, identity/age, AML, responsible-gambling, payment, accounting, security and recovery gates are independently approved.

## Release gate

PR #5 is merged and deployed. Migration 0007 is applied; GitHub validation, CodeQL, the Playwright browser matrix, the database restore rehearsal and post-deploy production smoke all passed. Remaining pre-real-money gates are an independent third-party penetration test, a full-service RPO/RTO exercise, legal/licensing approval and all payment/identity/responsible-gambling controls.