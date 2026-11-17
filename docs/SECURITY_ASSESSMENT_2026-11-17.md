# SPORE BET — Security and Recovery Assessment

**Assessment date:** 17 November 2026  
**Target:** https://spore-bet.pages.dev and SPOREADVENTURESLIMITED/spore-bet  
**Assessment type:** Internal source/configuration review and bounded regression planning. This is not an independent third-party penetration-test certificate.

## Executive result

The application remains **demo-only**. No real-money wagering, deposits, withdrawals, payouts, or payment-provider integrations are enabled. No destructive production test was performed.

The review identified two session-lifecycle gaps: there was no inactivity timeout and no single action to revoke all administrator sessions. Fixes are proposed in PR #5. A first mobile browser run also exposed horizontal overflow; a responsive CSS fix and repeat tests are in PR #6. They add a 30-minute idle timeout, retain the seven-day absolute expiry, and provide an MFA-protected organization-wide administrator-session revocation action. The invoking session is also revoked and customer sessions are unaffected.

## Scope reviewed

- Pages Functions authentication, session creation/lookup/logout, admin overview and MFA paths.
- Global request middleware and API security headers.
- Demo betting API, D1 schema/migrations, idempotency and wallet/ledger controls.
- Public, admin and money-preview UI paths.
- D1 production database metadata, health/integrity queries, export and Time Travel bookmark access.
- CI validation and a new Playwright desktop/mobile regression matrix.

## Evidence and results

| Area | Result | Evidence / limitation |
|---|---|---|
| Administrator authorization | Existing admin overview is role- and MFA-gated | Prior production check: anonymous request returned 401; admin account and MFA were previously verified. |
| Session security | Improvement prepared | PR #5 adds 30-minute idle expiry and all-admin revocation; migration 0007 initializes activity timestamps. Not active in production until PR merge and deployment. |
| API safeguards | Source reviewed; automated regression added | Existing middleware rejects cross-origin state-changing requests and applies security headers. New browser test checks headers and a cross-site logout attempt. |
| SQL handling | Source reviewed | Parameterized D1 statements are used in the reviewed authentication and betting paths. |
| Browser regression | Playwright matrix added; mobile issue found and fix proposed | Chromium, Firefox, WebKit, Pixel 7 and iPhone 13 configurations. The first run found horizontal overflow on Pixel 7 and iPhone 13; CSS remediation is in PR #6 and must pass a fresh run before release. |
| Database quick integrity | Passed | D1 PRAGMA quick_check returned ok; PRAGMA foreign_key_check returned no rows. |
| Full SQLite integrity | Passed on exported restore | GitHub Actions exported production D1, restored the SQL dump into a clean local SQLite database, ran PRAGMA integrity_check = ok and foreign_key_check with no violations. The temporary export and restored database were deleted from the ephemeral runner. |
| D1 export | Export operation completed | Cloudflare export endpoint reported status=complete; signed SQL artifact was not retrievable from the isolated execution environment. |
| Point-in-time recovery | Availability confirmed | Database reports version=production; current and prior Time Travel bookmarks were retrievable. No restore was run because Time Travel restore overwrites the target database in place and D1 does not currently provide a safe clone/fork for this test. |
| Restore rehearsal / RPO / RTO | SQLite and temporary D1 restore passed; full-service RPO/RTO remain open | The SQL export restored into isolated SQLite and a temporary D1 database. Full SQLite integrity_check returned ok; D1 quick_check and foreign_key_check passed; demo-only flags and wallet/ledger reconciliation passed; the temporary D1 and export files were deleted. RPO/RTO for restoring the whole service, DNS and application deployment remain unmeasured. |
| Independent penetration test | Not completed | Requires an independent security tester with an agreed scope and report. This review must not be represented as third-party certification. |

## Findings and remediation

### SEC-01 — Missing idle-session expiry
**Status:** Remediation proposed in PR #5.  
**Impact:** A valid session could remain usable until its absolute expiry or manual revocation, even after a long idle period.  
**Fix:** Add last_seen_at, initialize it at session creation, update it on authenticated activity, and reject sessions idle for more than 30 minutes. The seven-day absolute lifetime remains.  
**Verification:** Test active session refresh, rejection after 30 minutes, rejection after absolute expiry, and no refresh for revoked sessions.

### SEC-02 — No administrator-wide session revocation
**Status:** Remediation proposed in PR #5.  
**Impact:** Incident response required individual session revocation or manual database operations.  
**Fix:** Add an MFA-protected endpoint and dashboard control to revoke every active administrator session, including the caller, with an audit event. Customer sessions are not changed.  
**Verification:** Confirm non-admin and non-MFA callers are rejected; all admin sessions are revoked atomically; customer sessions remain active; audit event is written.

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

Do not deploy PR #5 until both GitHub Actions validation and browser regression workflows pass. After merge, confirm migration 0007 is applied before the Pages Functions deployment, then verify /api/health, anonymous admin denial, MFA admin access, idle expiry, and organization-wide session revocation using an approved administrator test window.