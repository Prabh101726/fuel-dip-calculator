# Fuel Dip Calculator

Replaces the paper **Safe Discharge Sheet** and a 327-page dip-chart PDF for fuel
delivery drivers. Pick a tank type and safe-fill % (90% or 95%), enter a dip
reading, and get volume + safe headroom instantly. After delivery, enter the
closing dip for delivered volume and reconciliation against the planned amount.

**Live:** [fuel-dip-calculator.vercel.app](https://fuel-dip-calculator.vercel.app)

Built under **SRV Freight Inc** / **Detours Fleet Operations**, separate from
[Detours](https://detours-app.com) (own repo, own users). Contact:
[contact@detours-app.com](mailto:contact@detours-app.com).

## Status

**v0.2.0 — soft launch / pre-production** (Jul 2026). Core driver workflow is live:

- Email/password signup & sign-in (Confirm email enabled)
- Forgot password / reset
- 7-day trial (new accounts); planned paid plan **$2.99/month** (copy only — Stripe not shipped yet)
- 4-tab multi-tank calculator
- History, Privacy, Terms, safety reminders

**Not yet:** Stripe Checkout, PWA/offline, signature capture (image), history filters.

## Stack

- [Next.js](https://nextjs.org) (TypeScript, App Router)
- [Supabase](https://supabase.com) (Postgres, Auth, RLS)
- [Vercel](https://vercel.com)
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

4. Checks used by CI:

   ```bash
   npm run lint && npm run typecheck && npm run test && npm run build
   ```

## Docs

| Doc | What |
| --- | --- |
| [`CLAUDE.md`](CLAUDE.md) | Agent/product guide — current live behavior & constraints |
| [`docs/superpowers/specs/2026-07-23-fuel-dip-calculator-design.md`](docs/superpowers/specs/2026-07-23-fuel-dip-calculator-design.md) | Original v1 design (auth has since diverged) |
| [`docs/superpowers/specs/2026-07-26-pre-production-readiness-design.md`](docs/superpowers/specs/2026-07-26-pre-production-readiness-design.md) | Pre-production readiness spec |
| [`docs/superpowers/plans/2026-07-26-pre-production-readiness.md`](docs/superpowers/plans/2026-07-26-pre-production-readiness.md) | Pre-production implementation plan |

## Safety note

Dip → volume math is safety-critical. Interpolation never extrapolates outside a
chart; drivers must still verify the physical tank tag matches the selected chart
and site-plan tank charts before delivery.
