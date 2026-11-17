# SPORE BET — Administrator Configuration & Launch Runbook

This runbook intentionally leaves organization-specific and regulated-business decisions to the authorized administrator. Do not send passwords, TOTP seeds, API tokens or payment credentials in chat or source control.

## A. Required infrastructure secrets

In Cloudflare Pages → `spore-bet` → Settings → Variables and Secrets, verify the production secret:

- `MFA_ENCRYPTION_KEY`: secret text, at least 32 characters of high-entropy random material. Store the recovery copy in the organization's approved secrets vault. Do not put it in GitHub, D1, logs or chat.
- `ADMIN_BOOTSTRAP_TOKEN`: secret text, at least 32 characters of high-entropy random material. Generate it with a password manager or cryptographically secure generator; never reuse it or put it in GitHub, D1, logs or chat. It is consumed by the first successful administrator activation.
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
