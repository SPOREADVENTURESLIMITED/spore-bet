# SPORE BET — Administrator Configuration & Launch Runbook

This runbook intentionally leaves organization-specific and regulated-business decisions to the authorized administrator. Do not send passwords, TOTP seeds, API tokens or payment credentials in chat or source control.

## A. Required infrastructure secrets

In Cloudflare Pages → `spore-bet` → Settings → Variables and Secrets, verify the production secret:

- `MFA_ENCRYPTION_KEY`: secret text, at least 32 characters of high-entropy random material. Store the recovery copy in the organization's approved secrets vault. Do not put it in GitHub, D1, logs or chat.

The repository's deployment workflow also requires GitHub Actions secrets maintained by the repository owner:

- `CLOUDFLARE_API_TOKEN`: narrowly scoped to the required Pages deployment and D1 migration actions.
- `CLOUDFLARE_ACCOUNT_ID`: the intended Cloudflare account identifier.

Cloudflare does not reveal a stored secret value after creation. Verify configuration by executing the relevant runtime function, not by expecting to read the secret back.

## B. Create the first administrator (manual, controlled operation)

Public registration always creates a customer. There is deliberately no public admin bootstrap endpoint.

1. The designated administrator registers a normal account through the public website using the intended administrator email or phone.
2. The administrator confirms the account identifier with the organization owner through an approved channel.
3. An authorized Cloudflare/D1 operator performs a narrowly scoped role change in the production D1 console. First inspect the exact account:

```sql
SELECT id, email, phone, role, status
FROM users
WHERE lower(email) = lower('ADMINISTRATOR_EMAIL')
   OR phone = '+INTERNATIONAL_NUMBER';
```

4. Confirm exactly one intended row and then promote only that row:

```sql
UPDATE users
SET role = 'admin', updated_at = datetime('now')
WHERE id = 'CONFIRMED_USER_UUID'
  AND status = 'active'
  AND role = 'customer';
```

5. Verify the result:

```sql
SELECT id, email, phone, role, status, totp_enabled
FROM users
WHERE id = 'CONFIRMED_USER_UUID';
```

Do not run a broad update, promote an unverified account, or put a real email/phone/UUID in this repository. Record who authorized and executed the change in the organization's change log.

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
