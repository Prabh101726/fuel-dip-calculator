# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| [v0.2.0](https://github.com/Prabh101726/fuel-dip-calculator/releases/tag/v0.2.0) (soft launch) | Yes |
| Earlier untagged builds | Best effort only |

Production app: https://fuel-dip-calculator.vercel.app

## Reporting a vulnerability

Email **[contact@detours-app.com](mailto:contact@detours-app.com)** with:

- A short description of the issue
- Steps to reproduce (or a PoC)
- Impact (data exposure, account takeover, calculation integrity, etc.)
- Whether the issue is already public

Please **do not** open a public GitHub issue for security bugs until we’ve had a chance to respond.

We aim to acknowledge reports within a few business days.

## Current security model (v0.2.0)

- **Auth:** Supabase Auth, email/password, Confirm email enabled, forgot-password via `/auth/reset-password`
- **Tenancy:** Company-scoped data via Postgres **Row Level Security** on `drivers` / `dip_calculations`; dip chart catalog (`tank_types`, `dip_chart_points`) is shared reference data readable by authenticated users
- **Trial gate:** Middleware blocks `/calculator` and `/history` after `companies.trial_ends_at` (UI/session layer); offline calculator also gates on cached `trialEndsAt` in IndexedDB (SW bypasses middleware)
- **Secrets:** Only `NEXT_PUBLIC_*` Supabase keys in the browser; service role / DB password stay server-side / `.env.local` (never committed)
- **Safety-critical math:** Dip→volume interpolation refuses extrapolation; unit + PDF regression tests cover the calculation chain
- **Offline PWA:** Service worker caches app shell only — **not** Supabase API responses. Chart points and saves use IndexedDB / outbox in the page. Prior online sign-in required for offline use.

## Known limitations (soft launch)

These are intentional or deferred — not considered resolved:

- **Open self-signup** — anyone can create an account and start a trial (email confirm required)
- **Trial enforcement** is primarily middleware/UI (+ offline IDB cache) today; not fully enforced inside every RLS policy
- **Saved calculation volumes** are accepted from the client on insert (not re-validated server-side against the chart)
- **Paid billing** (`$2.99/month`) is messaging only — Stripe Checkout / webhooks not shipped
- **Offline History** is not supported — History needs network
- **Leaked-password protection** and further Auth hardening may still be enabled in the Supabase dashboard over time

## Out of scope for reports

- Issues that only affect local `config.toml` / local Site URL misconfiguration
- Feature requests (Stripe, invite-only) — use normal product channels
- Social engineering of individual driver accounts without a product vulnerability

## Operators

Operated by **SRV Freight Inc** and **Detours Fleet Operations**.
