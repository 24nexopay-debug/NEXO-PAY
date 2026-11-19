# NEXO PAY Bangladesh

A responsive starter frontend for NEXO PAY, connected to the existing Supabase project.

## Deploy free with GitHub Pages
1. Open **Settings → Pages** and choose **GitHub Actions** as the build and deployment source if GitHub asks.
2. The workflow in `.github/workflows/pages.yml` deploys the site automatically after each push to `main`.
3. After the first successful run, the site URL is usually https://24nexopay-debug.github.io/NEXO-PAY/.

## Supabase
The browser uses only the Supabase publishable key. Never put a service-role key in frontend files.
Set the production URL and redirect URL in Supabase Authentication → URL Configuration after Pages is live.

## Important launch limitations
- Login and registration use Supabase Auth.
- Wallet balance and transaction history are read-only views of backend data.
- Recharge and bill-payment catalogues require verified active rows in Supabase.
- Payment providers are disabled until merchant credentials, callbacks, and verification are configured.
- Wallet spending, live recharge, bill payment, refunds, and settlements are not enabled by this frontend.
- Admin functions remain server-authorized; the browser must not be treated as an authorization boundary.

Before production use, restrict the admin API CORS policy to the final Pages domain, enable leaked-password protection, configure a Super Admin, and complete provider integration and end-to-end tests.
