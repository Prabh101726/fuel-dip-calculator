# Fuel Dip Calculator

Replaces the paper **Safe Discharge Sheet** and a 327-page dip-chart PDF for fuel
delivery drivers. Pick a tank type and safe-fill % (90% or 95%), enter a dip
reading, and get volume + safe headroom instantly. After delivery, enter the
closing dip for delivered volume and reconciliation against the planned amount.

**Live:** [fuel-dip-calculator.app](https://fuel-dip-calculator.app)
([vercel.app](https://fuel-dip-calculator.vercel.app) still works)

Built under **Detours Fleet Operations**, separate from
[Detours](https://detours-app.com) (own repo, own users). Contact:
[contact@detours-app.com](mailto:contact@detours-app.com).

## Status

**v0.2.0 — soft launch / pre-production** (Jul 2026). Core driver workflow is live:

- Phone OTP sign-in / signup (Canada / US +1)
- 7-day trial (new drivers); paid plan **$2.99 CAD/month per driver** via Stripe Checkout
- 4-tab multi-tank calculator
- **Installable PWA** — used-tank chart cache, draft restore after swipe-up, offline save queue (History still needs network)
- History, Privacy, Terms, safety reminders

**Not yet:** signature capture (image), history filters, Sentry.

## Stack

- [Next.js](https://nextjs.org) (TypeScript, App Router)
- [Supabase](https://supabase.com) (Postgres, Auth, RLS)
- [Vercel](https://vercel.com)
- [Serwist](https://serwist.pages.dev) (service worker) + IndexedDB (`idb`)
- GitHub Actions CI (lint, type-check, unit tests, build)

## Local setup

1. Clone the repo and install:

   ```bash
   npm install
   ```

2. Copy env vars into `.env.local` (never commit this file):

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=…
   NEXT_PUBLIC_SUPABASE_ANON_KEY=…
   ```

3. Run:

   ```bash
   npm run dev
   ```

   For local service-worker testing (Serwist is disabled in plain `next dev`):

   ```bash
   npm run build && npm start
   # or: npm run dev:pwa
   ```

4. Checks used by CI:

   ```bash
   npm run lint && npm run typecheck && npm run test && npm run build
   ```

## Docs

| Doc | What |
| --- | --- |
| [`CLAUDE.md`](CLAUDE.md) | Agent/product guide — current live behavior & constraints |
| [`SECURITY.md`](SECURITY.md) | Vulnerability reporting & soft-launch security posture |
| [`docs/superpowers/specs/2026-07-23-fuel-dip-calculator-design.md`](docs/superpowers/specs/2026-07-23-fuel-dip-calculator-design.md) | Original v1 design (auth has since diverged) |
| [`docs/superpowers/specs/2026-07-26-pre-production-readiness-design.md`](docs/superpowers/specs/2026-07-26-pre-production-readiness-design.md) | Pre-production readiness spec |
| [`docs/superpowers/plans/2026-07-26-pre-production-readiness.md`](docs/superpowers/plans/2026-07-26-pre-production-readiness.md) | Pre-production implementation plan |
| [`docs/superpowers/specs/2026-07-29-offline-pwa-design.md`](docs/superpowers/specs/2026-07-29-offline-pwa-design.md) | Offline PWA (Project 2) |

## Safety note

Dip → volume math is safety-critical. Interpolation never extrapolates outside a
chart; drivers must still verify the physical tank tag matches the selected chart
and site-plan tank charts before delivery.
