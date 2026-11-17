# SPORE BET — administrator payment API configuration

Configure credentials as **Cloudflare Pages project secrets/environment variables** for project `spore-bet` (Production and Preview as appropriate). Never paste secret values into the public payment-settings form or commit them to GitHub.

## Airtel Money collection / disbursement
- `AIRTEL_CLIENT_ID`
- `AIRTEL_CLIENT_SECRET`
- `AIRTEL_API_KEY`
- `AIRTEL_COUNTRY` (UG)
- `AIRTEL_CURRENCY` (UGX)
- `AIRTEL_BASE_URL` (provider-issued environment URL)
- `AIRTEL_CALLBACK_SECRET`

Merchant destination remains the editable payment setting already stored in D1.

## MTN MoMo collection / disbursement
- `MTN_MOMO_SUBSCRIPTION_KEY`
- `MTN_MOMO_API_USER`
- `MTN_MOMO_API_KEY`
- `MTN_MOMO_TARGET_ENVIRONMENT` (sandbox or production)
- `MTN_MOMO_BASE_URL` (provider-issued environment URL)
- `MTN_MOMO_CALLBACK_SECRET`

Merchant destination remains the editable payment setting already stored in D1.

## Equity Bank
- `EQUITY_API_BASE_URL`
- `EQUITY_CLIENT_ID`
- `EQUITY_CLIENT_SECRET`
- `EQUITY_API_KEY`
- `EQUITY_CALLBACK_SECRET`

The account number, branch and SWIFT remain editable payment destination settings in D1.

## Application endpoints
- `GET/POST /api/deposits` — authenticated deposit requests and history.
- `GET/POST /api/withdrawals` — authenticated withdrawal requests and history.
- `GET/POST /api/admin/cash-transactions` — MFA-protected administrator review, approval, rejection and payout recording.
- `GET/PUT /api/admin/payment-settings` — MFA-protected editable merchant/bank destinations.
- `POST /api/bets` with `walletType: "cash"` — cash-wallet bet placement; controlled by `app_settings.real_money_enabled`.

Provider credentials must be provisioned by each merchant/provider and configured in Cloudflare. Transaction approvals and wallet ledger entries are recorded in D1; never mark a deposit approved until receipt is confirmed, or a withdrawal paid until payout is sent.
