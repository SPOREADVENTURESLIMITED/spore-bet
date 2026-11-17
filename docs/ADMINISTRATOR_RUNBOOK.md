# SPORE BET — Administrator Configuration & Launch Runbook

This runbook intentionally leaves organization-specific and regulated-business decisions to the authorized administrator. Do not send passwords, TOTP seeds, API tokens or payment credentials in chat or source control.

## A. Required infrastructure secrets

In Cloudflare Pages → `spore-bet` → Settings → Variables and Secrets, verify the production secret:

- `MFA_ENCRYPTION_KEY`: secret text, at least 32 characters of high-entropy random material. Store the recovery copy in the organization's approved secrets vault. Do not put it in GitHub, D1, logs or chat.
- `ADMIN_BOOTSTRAP_TOKEN`: the one-time token was consumed and removed from production after first-admin activation. Recreate it only for an approved bootstrap recovery; never keep it permanently or put it in GitHub, D1, logs or chat.
- `ADMIN_BOOTSTRAP_EMAIL`: plain-text Pages environment variable set to the exact designated first-administrator email (for this setup: `sporeafrica@gmail.com`).

The repository's deployment workflow also requires GitHub Actions secrets maintained by the repository owner:

- `CLOUDFLARE_API_TOKEN`: narrowly scoped to the required Pages deployment and D1 migration actions.
- `CLOUDFLARE_ACCOUNT_ID`: the intended Cloudflare account identifier.

Cloudflare does not reveal a stored secret value after creation. Verify configuration by executing the relevant runtime function, not by expecting to read the secret back.

## B. Create the first administrator (one-time protected activation)

The first administrator is created through a dedicated bootstrap endpoint protected by a one-time Cloudflare secret. It is not ordinary public customer registration and it cannot accept a caller-selected role.

1. In Cloudflare Pages → `spore-bet` → Settings → Variables and Secrets → Production, add:
   - `ADMIN_BOOTSTRAP_EMAIL` as a text variable set to `sporeafrica@gmail.com`.
   - `ADMIN_BOOTSTRAP_TOKEN` as a secret text value containing at least 32 characters of cryptographically random material.
2. Save the production variables and trigger/retry a production deployment so the Pages Functions runtime receives them.
3. Open `https://spore-bet.pages.dev/admin` and expand **First administrator activation · one-time setup**.
4. Enter the designated administrator's full name, `sporeafrica@gmail.com`, optional phone in international format, a unique password of at least 12 characters, and the one-time token.
5. The server checks the configured email, token, rate limit and one-time D1 guard. It creates exactly one active `admin` account, records an audit event, consumes the bootstrap guard and establishes a session.
6. The form is no longer usable after successful activation or if an administrator already exists. Do not reset the D1 bootstrap guard or reuse the token to create additional admins.
7. Proceed immediately to MFA enrollment below. Remove/rotate the `ADMIN_BOOTSTRAP_TOKEN` secret in Cloudflare after successful activation; the D1 guard remains consumed.

If the activation reports that the setup is not configured, verify both production variables are present and the latest deployment includes them. If it reports that setup has already been used, inspect the D1 `admin_bootstrap` row and administrator roster; do not clear the guard without an approved recovery procedure.

## C. Administrator MFA enrollment

1. Open `https://spore-bet.pages.dev/admin`.
2. Sign in with the designated administrator account.
3. Start authenticator setup and add the displayed secret to an approved authenticator application.
4. Verify the current six-digit code.
5. Confirm the admin dashboard loads and that a fresh login requires the authenticator code.
6. Keep recovery arrangements for the authenticator under the organization's security policy. Never share the TOTP secret.

## D. Admin acceptance checks

- A non-admin account receives 403 from `GET /api/admin/overview`.
- An unauthenticated request receives 401.
- An admin without completed MFA cannot access overview data.
- An MFA-verified admin can load the dashboard and audit activity.
- Logout revokes the session; expired sessions cannot access protected routes.
- Registration cannot choose the admin role.
- Rate limits reject repeated login and registration attempts.
- Demo bet placement rejects insufficient balance, closed markets, started events and reused/invalid idempotency keys.
- Wallet balance and ledger changes remain consistent after each successful demo bet.

Use controlled test accounts and clearly labeled demo records. Do not test with real money or real payment instruments.

## E. Administrator-owned configuration checklist

The administrator must supply and approve, where applicable:

- Legal entity name, registered address, contacts and responsible officers.
- Jurisdictions served and documented legal/licensing advice and approvals.
- Brand assets, public contact channels, customer support hours and escalation contacts.
- Approved privacy notice, terms, cookies notice, retention schedule and consent wording.
- Sports-data provider contract, feed credentials, event coverage, settlement source and outage procedure.
- Payment-provider approvals, supported currencies, fees, reconciliation and refund policies.
- KYC/AML vendor, age threshold, sanctions rules, fraud rules and case escalation.
- Responsible-gambling policy, limits, cooling-off, self-exclusion and support resources.
- Notification providers and templates.
- Admin user roster, roles, MFA recovery, access reviews and incident contacts.
- Backup, restoration, retention, monitoring and service-level requirements.

These are intentionally not fabricated or prefilled by engineering.

## F. Release gate

Keep SPORE BET in demo-only mode until every required legal, licensing, payment, identity, AML, responsible-gambling, financial-control and security gate is documented as approved. This codebase is not certified for real-money operations. A future regulated launch requires a separately reviewed architecture, implementation, independent security testing and jurisdiction-specific sign-off.


## G. Session inactivity and emergency administrator sign-out

- Every authenticated request updates the session's `last_seen_at` timestamp.
- Sessions idle for more than 30 minutes are rejected; the absolute seven-day expiry remains in force. Migration 0007 was applied to production on 17 November 2026; sessions created before the migration with activity older than 30 minutes require a fresh login.
- The dashboard includes **Revoke all administrator sessions**. This action requires an active MFA-verified administrator, revokes all administrator sessions across the organization (including the invoking session), writes an audit event, and clears the current session cookie.
- Use this control after suspected administrator credential exposure, lost devices, or a planned organization-wide sign-out. All administrators must sign in again and complete MFA.
- Customer sessions are not affected by this administrator-only operation.

## H. Backup and recovery verification record

- D1 export API accepted a full SQL export request and reported the export completed.
- D1 `PRAGMA quick_check` returned `ok`; `PRAGMA foreign_key_check` returned no rows.
- D1 denied direct `PRAGMA integrity_check` through the authorized query interface (`SQLITE_AUTH`). The scheduled GitHub Actions export/restore workflow bypasses that limitation safely by restoring the export into an isolated SQLite file and running the full engine-level integrity check there.
- The SQL-to-SQLite and SQL-to-temporary-D1 restoration tests both passed. The workflow verified the restored D1 database, then deleted the temporary D1 and all export files. A retained off-site archive and measured full-service RPO/RTO remain separate recovery requirements.


## I. Automated backup restore verification

- The GitHub Actions workflow `SPORE BET backup restore and SQLite integrity check` runs after successful production Pages deployments, weekly on Monday at 02:17 UTC, and by manual dispatch.
- It exports production D1, restores the SQL into isolated SQLite, runs full `PRAGMA integrity_check` and `PRAGMA foreign_key_check`, creates a temporary D1 database, imports the export there, verifies D1 quick-check/foreign keys, demo-only flags and wallet-to-ledger reconciliation, then deletes the temporary D1 and all export files.
- Latest completed run: 17 November 2026 — successful after migration 0007; full SQLite integrity check returned `ok`, the temporary D1 import completed 90 queries across 15 tables, D1 checks and demo-only/ledger invariants passed, and cleanup succeeded.
- This verifies export restoration into SQLite and D1. It does not retain an off-site backup archive or measure full-service RPO/RTO. D1 Time Travel is available for point-in-time recovery; maintain a separately retained encrypted backup if recovery beyond Cloudflare's Time Travel retention is required.


## J. Deployment and post-deployment checks

- The normal production Pages deployment workflow applies pending D1 migrations before publishing the application. Migration 0007 is applied in production.
- The separate **Apply SPORE BET D1 migrations (manual recovery)** workflow is manual-only; do not run it concurrently with a production deployment.
- After a successful deployment, the backup restore workflow exports production D1, restores into isolated SQLite and temporary D1, validates integrity and key invariants, and deletes temporary restore data. The post-deploy smoke test runs after that restore workflow succeeds.
- The post-deploy smoke checks the homepage, `/admin`, `/api/health`, demo-only flags, anonymous administrator denial, unauthenticated session-revocation denial, security headers and cross-origin request protection.
- Automated browser regression passed on Chromium, Firefox, WebKit, Pixel 7 emulation and iPhone 13 emulation. These are emulated browser profiles, not physical-device certification.
