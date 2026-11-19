# NEXO PAY Bangladesh

NEXO PAY is a Bengali-first digital services frontend connected to the Supabase project and deployed on GitHub Pages.

## Production site
https://24nexopay-debug.github.io/NEXO-PAY/

## Deploy
The workflow at `.github/workflows/pages.yml` deploys the static site to GitHub Pages on pushes to `main`.

## Current functionality
- Supabase email/password registration and login.
- Password reset email request.
- Read-only wallet balance and recent transaction history for the signed-in user.
- Public telecom operator and service-category catalogue.
- Active bundle catalogue display (currently no active bundles are configured).
- Merchant onboarding request through the authenticated `merchant-api` Edge Function.
- Restricted initial Super Admin bootstrap button for the allowlisted account; the database RPC remains the authority.
- Edge Functions use the production GitHub Pages origin for browser CORS.

## Supabase production setup still required
1. In Authentication → URL Configuration, set the Site URL to `https://24nexopay-debug.github.io/NEXO-PAY/` and add the matching redirect URL.
2. In Authentication → Security and Protection, enable leaked-password protection.
3. Sign in with the allowlisted owner account `24nexopay@gmail.com` and explicitly press **Super Admin সক্রিয় করুন** in the dashboard. The database checks the allowlist; frontend visibility is not the security boundary.
4. Configure an approved payment provider account and store its credentials only in Supabase Edge Function secrets. Never add secret keys to this repository or browser config.
5. Configure provider callback/webhook URLs and signing secrets, complete provider sandbox tests, and obtain any required Bangladesh regulatory/provider approvals.
6. Add verified operator package data before publishing recharge offers.

## Not enabled / not represented as live
- Wallet top-up, withdrawal, transfer, or spending.
- Live mobile recharge and bill payment.
- Merchant payment collection and settlement.
- Refunds, disputes, partner API production access.
- Payment providers are currently disabled; do not enable them without credentials and end-to-end verification.

## Security
- Browser config contains only the Supabase URL and publishable key.
- Service-role keys remain server-side in Supabase.
- User wallet and transaction reads rely on Row Level Security.
- Admin and merchant actions are checked by server-side Edge Functions and database RPCs.
- Never commit API secrets, webhook signing secrets, or service-role keys.
