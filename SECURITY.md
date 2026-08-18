# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| [v0.2.2](https://github.com/Prabh101726/fuel-dip-calculator/releases/tag/v0.2.2) | Yes |
| [v0.2.1](https://github.com/Prabh101726/fuel-dip-calculator/releases/tag/v0.2.1) | Yes |
| [v0.2.0](https://github.com/Prabh101726/fuel-dip-calculator/releases/tag/v0.2.0) (soft launch) | Yes |
| Earlier untagged builds | Best effort only |

Production app: https://fuel-dip-calculator.app
(fallback: https://fuel-dip-calculator.vercel.app)

## Reporting a vulnerability

Email **[contact@detours-app.com](mailto:contact@detours-app.com)** with:

- A short description of the issue
- Steps to reproduce (or a PoC)
- Impact (data exposure, account takeover, calculation integrity, etc.)
- Whether the issue is already public

Please **do not** open a public GitHub issue for security bugs until we’ve had a chance to respond.

We aim to acknowledge reports within a few business days.

## Current security model (v0.2.2)

- **Auth:** Supabase Auth, **phone OTP only** (Canada / US +1). App UI has no email signup or email/password sign-in. **Email provider Disabled** in the dashboard (Aug 18) — do not `supabase config push`.
- **Tenancy:** Driver-scoped data via Postgres **Row Level Security** on `drivers` / `dip_calculations` (`auth.uid()`); dip chart catalog (`tank_types`, `dip_chart_points`) is shared reference data readable by authenticated users
- **Trial / paid gate:** Middleware + offline IDB cache for UI; **`my_access_active()` RLS** blocks `dip_calculations` INSERT/UPDATE when access is inactive (SELECT still allowed for own rows)
- **Payments:** Stripe Checkout. We send Stripe the account **phone** (and email only if one already exists). Card number, CVC, expiry, and Checkout billing email/phone are collected by **Stripe**, not stored on our servers. We keep Stripe customer/subscription ids and status. See `/privacy` and [Stripe’s Privacy Policy](https://stripe.com/privacy).
- **Secrets:** Only `NEXT_PUBLIC_*` (Supabase anon, optional Sentry DSN) in the browser; service role, Stripe secrets, Resend API key stay server-side / Vercel env (never committed)
- **Safety-critical math:** Dip→volume interpolation refuses extrapolation; unit + PDF regression tests cover the calculation chain. On save, a BEFORE INSERT OR UPDATE trigger recomputes `server_*` volumes and sets `volume_mismatch` (store-both — never blocks the write)
- **Auth callback:** `?next=` allowlisted to `/calculator` or `/history` only
- **Offline PWA:** Service worker caches app shell only — **not** Supabase, Stripe, or Sentry API responses (`/api/` is NetworkOnly). Chart points and saves use IndexedDB / outbox in the page. Prior online sign-in required for offline use.
- **Errors:** Sentry in production (`sendDefaultPii: false`). Feedback body is emailed to operations and stored in `feedback`; it is not a substitute for vulnerability reports.

## Known limitations (soft launch)

These are intentional or deferred — not considered resolved:

- **Open self-signup** — anyone with a Canada / US mobile can create an account and start a trial (OTP; server-side throttle)
- **Offline History** is not supported — History needs network
- **Mismatch UI** — `volume_mismatch` rows are audit/query only; no driver-facing banner yet

## Out of scope for reports

- Issues that only affect local `config.toml` / local Site URL misconfiguration
- Feature requests (invite-only, history filters) — use normal product channels
- Social engineering of individual driver accounts without a product vulnerability

## Operators

Operated by **Detours Fleet Operations**.
