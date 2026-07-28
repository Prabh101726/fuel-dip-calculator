# Fuel Dip Calculator — Agent Guide

Second product under SRV Freight Inc, separate from Detours (own repo, own users).
Replaces a paper "Safe Discharge Sheet" + a 327-page dip-chart PDF that fuel
delivery drivers currently do by hand: pick a tank type + safe-fill %, enter a dip
reading, get volume + safe headroom instantly; after delivery, enter the closing
dip and get delivered volume + reconciliation.

**Stack:** Next.js (TypeScript, App Router) · Supabase (Postgres, Auth, RLS) ·
Vercel · GitHub Actions CI (lint, type-check, unit tests on every push).

**Status:** Foundation (Jul 23), driver-facing + password auth (Jul 23),
multi-tank calculator (Jul 24), **pre-production readiness (Jul 26)**, and
**calculator form UX (Jul 28)** are merged to `main` and **live in production**:
https://fuel-dip-calculator.vercel.app (Vercel project `detours/fuel-dip-calculator`).
Live now: email/password signup with Confirm email, forgot-password /
`/auth/reset-password`, **7-day trial** for new companies (was 14-day at
launch — existing `trial_ends_at` not backfilled), auto-provisioned
company/driver on first confirmed signup or sign-in, 4-tab multi-tank
calculator with **product-grade dropdown** (tab labels show product when
selected), public `/privacy` + `/terms`, safety reminders, and flat history.
Jul 26 also fixed a safety-critical tank-picker race (stale dip-chart fetch)
and named operators **SRV Freight Inc and Detours Fleet Operations** on legal
pages. Current soft-launch tag: **v0.2.0**. Specs:
`docs/superpowers/specs/2026-07-26-pre-production-readiness-design.md`,
`docs/superpowers/specs/2026-07-28-calculator-form-ux-design.md`. Original v1
design: `docs/superpowers/specs/2026-07-23-fuel-dip-calculator-design.md`
(**auth diverged twice** — magic-link trial → password auth; password is live).

**Still open / next priorities:**
- **PWA / full offline (Project 2)** — still a plain responsive web app.
  Planned: installable shell, cache dip charts, offline calc, queued saves,
  drafts that survive swipe-up. Est. ~1–2 weeks. Schema allows offline queue
  later without rewrite; don't build until asked.
- **Stripe after trial** — `$2.99/month` is copy-only on `/trial-ended` today;
  Checkout + webhook + subscription unlock not built (est. ~2–3 days MVP /
  ~4–6 days solid).
- Vercel **Preview** env vars (`NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`) still unset — Production only.
- Security hardenings from Jul 26 audit (not yet coded): enforce trial/paid in
  RLS (not middleware-only), server-side recompute of chart volumes on save,
  leaked-password protection, constrain `/auth/callback` `next` param.
- Signature capture (image), history filtering, 12 flagged tanks in
  `review_needed.json`, Sentry — deferred.
- Do **not** push full local `supabase/config.toml` via `supabase config push`
  (can clobber dashboard Auth URL / Confirm email settings).

## What's built (foundation phase)

- `lib/dip-calculator/` — `interpolateVolume()` (linear interpolation over a
  tank's dip chart, throws `DipOutOfRangeError` rather than extrapolating) and
  the two-phase `calculateBeforeDelivery()`/`calculateAfterDelivery()` chain
  (the #1-#7 fields). Fully unit-tested, including regression fixtures using
  real dip/volume readings transcribed from tanks #015, #014, #526 in the
  source PDF — see `interpolate.regression.test.ts`.
- `supabase/migrations/20260723120000_initial_schema.sql` — all 5 tables, the
  `my_company_id()` RLS helper, and policies. Already linked and pushed to the
  live `fuel-dip-calculator` Supabase project.
- `scripts/parse_dip_charts.py` + `scripts/generate_seed_sql.py` — the one-time
  PDF ETL described below. Already run against the real PDF: 305 tanks parsed,
  293 good, 12 flagged for manual review (capacity-tolerance mismatches — see
  `supabase/seed/review_needed.json`). `supabase/seed/dip_charts_seed.sql`
  (transaction-wrapped) has been run against the live database (Jul 23 2026) —
  confirmed 293 `tank_types` / 38,366 `dip_chart_points` rows live. The 12
  flagged tanks in `review_needed.json` are still excluded pending review.
- CI (`.github/workflows/ci.yml`): lint, typecheck, test, build on every push.

## What's built (driver-facing phase, Jul 23 2026)

- `lib/supabase/{client,server,middleware}.ts` — browser/server Supabase
  clients + session-refresh middleware (`@supabase/ssr`).
- `middleware.ts` — gates `/calculator` and `/history` behind an active
  session + unexpired trial; redirects to `/login` or `/trial-ended`.
- `app/login/page.tsx` + `LoginForm.tsx` — originally email-only magic-link
  sign-in; **superseded same day, see "Auth: magic-link → password" below.**
- `app/auth/callback/route.ts` — exchanges an auth code for a session, calls
  the `ensure_trial_driver()` RPC (auto-provisions `companies` + `drivers` on
  first login/signup only, 7-day trial for new companies via
  `companies.trial_ends_at` — see `20260726175154_seven_day_trial.sql`).
- `app/calculator/page.tsx` — thin wrapper using `next/dynamic({ ssr: false })`
  around `CalculatorClient.tsx`. Originally the single-tank flow directly;
  **superseded same week, see "Multi-tank calculator" below** — the `ssr: false`
  split itself is still load-bearing and still applies to the refactored shell.
  **The `ssr: false` split is load-bearing** — the original `useMemo`-created
  Supabase client broke `next build` because Next.js still server-renders
  `"use client"` pages once at build time even under `force-dynamic`; don't
  reintroduce a top-level `createClient()` call in a page component without
  this pattern (or lazy-create inside handlers only, like `login`/`trial-ended`
  already do).
- `app/history/page.tsx` — Server Component, flat list of the driver's own
  `dip_calculations` (RLS-scoped).
- `app/trial-ended/page.tsx` — shown when `trial_ends_at` has passed.
- `supabase/migrations/20260723161041_trial_and_ensure_driver.sql` — adds
  `companies.trial_ends_at` and the `ensure_trial_driver()` SECURITY DEFINER
  RPC.

## Auth: magic-link → password (Jul 23 2026, same day as driver-facing phase)

Cursor replaced the magic-link flow with email/password the same day it
shipped (commit `f161153`) — `LoginForm.tsx` now has sign-in and create-account
modes, both calling `supabase.auth.signInWithPassword` /
`supabase.auth.signUp`. `afterAuth()` still calls `ensure_trial_driver()` and
`my_trial_ends_at()` after either mode, so trial auto-provisioning is
unchanged — only the credential mechanism changed. A stale `otp_expired` /
`access_denied` URL error is caught and shown as "that email link expired,
sign in with email and password instead" (leftover magic-link links a driver
might still have).

## Pre-production readiness (Jul 26 2026)

Soft-launch hardening — shipped to `main` / production the same day. Spec +
plan under `docs/superpowers/`.

- **Email confirmation:** `LoginForm` `signUp` passes `options.emailRedirectTo`
  → `{origin}/auth/callback` (`lib/app-copy.ts`). Unconfirmed users have no
  session. **Ops done (user-confirmed Jul 26):** Supabase Site URL set to
  production + redirect allow-list for `/auth/callback` and
  `/auth/reset-password`; Confirm email enabled. (Earlier test hit
  `localhost:3000` + `otp_expired` before Site URL was fixed — sign-in after
  confirm still provisions via `ensure_trial_driver()` if driver row missing.)
- **Forgot password:** `resetPasswordForEmail` → `/auth/reset-password`, which
  exchanges the PKCE code **locally** and `updateUser({ password })`. **Never**
  route recovery through `/auth/callback` (trial gate would bounce expired
  trials before they can reset).
- **Legal:** public `/privacy` + `/terms`; signup checkbox required. Operator
  copy: **SRV Freight Inc and Detours Fleet Operations**. Contact:
  **`contact@detours-app.com`** (`CONTACT_EMAIL` in `lib/app-copy.ts`).
- **Safety reminder** (`SAFETY_REMINDER` in `lib/app-copy.ts`) on login +
  calculator: verify physical tank tag matches chart number **and** site-plan
  tank charts before delivery.
- **Trial:** migration `20260726175154_seven_day_trial.sql` — 7-day default +
  `ensure_trial_driver()` insert; existing companies unchanged. Trial-ended
  page mentions planned **$2.99/month** (copy only; `MONTHLY_PRICE_LABEL` in
  `lib/app-copy.ts`).
- **Tank-chart race fix** (commit `c6c012a`): `TankSlot` keeps
  `selectedTankIdRef` and ignores stale `dip_chart_points` responses via
  `isStaleTankPointsResponse()` so a slow fetch for tank A cannot overwrite
  tank B's points (wrong ullage risk).

## Multi-tank calculator (Jul 24 2026)

Real gas stations typically have 3-4 tanks; drivers wanted to enter all
opening (before-delivery) dips together, then come back per tank for the
after-delivery dip — not forced through one tank start-to-finish before
starting the next. Shipped as a fast-follow (commit `293de00`) to the
single-tank v1 that had explicitly deferred this:

- `CalculatorClient.tsx` is now a thin shell: auth/driver/company lookup, one
  shared `tank_types` fetch (not refetched per tab), a 4-button tab bar
  (`SLOT_COUNT = 4`, always visible), and mounts all 4 `<TankSlot>` instances
  simultaneously — inactive ones are hidden via CSS (`hidden`/`aria-hidden`),
  **never unmounted**, so each tab's state (selected tank, dip inputs, results)
  survives switching tabs. This is the load-bearing bit — don't refactor
  tab-switching to conditionally mount/unmount, it would silently wipe a
  driver's in-progress entry on another tab.
- **Tab labels** (Jul 28): product grade if set → else `#chart` if tank picked
  → else `Tank N`. Uses `tankTabLabel()` in `lib/product-grades.ts`. Slots
  report chart via `onSelectedChartChange` and product via
  `onSelectedProductChange`.
- `app/calculator/TankSlot.tsx` — per-tank form (tank picker, safe-fill %,
  product dropdown, before/after dips + results, location under after-delivery,
  retain/signature, save). Calculation logic
  (`calculateBeforeDelivery`/`calculateAfterDelivery`) was **not** changed.
  Still inserts one independent row per tank into `dip_calculations`.
- **Clear button** next to Save resets only that slot (`resetSlot()`) —
  doesn't touch the other 3 tabs.
- **Save no longer redirects to `/history`.** On success, `resetSlot()` + 2.5s
  "Saved ✓" flash so the driver can continue other tanks.

## Calculator form UX (Jul 28 2026)

Spec: `docs/superpowers/specs/2026-07-28-calculator-form-ux-design.md`
(commit `4ff9e49`).

- **Product grade** dropdown from `PRODUCT_GRADES` in `lib/product-grades.ts`:
  E15 Reg, E10 Reg, P93, P91, PE10, U94, LSD Clear, LSD Dyed (optional
  “Select product…”). Still stored as `product_grade` text.
- **Compartment #** removed from UI; saves `compartment_no: null` (column kept).
- **Location label** moved to the bottom of the After delivery section.
- No schema migration.

## Load-bearing constraints

- **These calculations are safety-critical.** An overfill from a wrong ullage
  number is a real-world spill risk, not a cosmetic bug. Any change to the
  dip→volume interpolation or the 7-field calculation chain (mirrors the paper
  form's #1–#7 fields) must be covered by the regression tests in the spec before
  it ships.
- **Two data categories, don't blur them:** the dip chart catalog (`tank_types`,
  `dip_chart_points`) is shared reference data, not owned by any one company —
  parsed once from the source PDF, reused by any future customer. Driver accounts
  and saved calculations (`dip_calculations`) are private per `company_id`. See
  the spec's Data Model section before adding tables.
- **v1 has no sites/tank-roster registry on purpose** — drivers pick tank type +
  safe-fill % directly per calculation, with a free-text location label. Don't
  reintroduce a `sites` table without checking the spec's "Out of Scope" section
  first; it was cut deliberately to avoid upfront admin setup blocking driver use.
- **Still a plain responsive web app, no offline/PWA.** Schema should still
  support an offline save queue later without a rewrite; Project 2 (full
  offline PWA) is the planned next large build when asked — don't start it
  unprompted.
## Source data

- `~/Downloads/FLT - DIPCHARTS (1) 2.pdf` — 327-page dip chart catalog, real
  extractable text (confirmed via `pdfplumber`), not scanned. Column layout needs
  coordinate-aware parsing, not naive `extract_text()` (columns can jumble).
- The paper "Safe Discharge Sheet" (photographed, not yet in-repo) defines the
  exact numbered fields `dip_calculations` mirrors.

## Housekeeping

- Repo lives at `~/dev/fuel-dip-calculator` — keep dev repos out of
  `~/Desktop`/`~/Documents` (iCloud), same convention as `detours-mobile` and
  `detours-website`.
- GitHub: `Prabh101726/fuel-dip-calculator` (public).
- Supabase project: `fuel-dip-calculator` (ref `oxxmcdtafnvnkbojnrgx`), org
  **SiteSync** (`mmlgaplkkzoteackwuez`) — same org as Detours's Project and
  Portfolio, but its own separate project/database. Region: Canada (Central).
  Credentials live in `.env.local` (gitignored, never committed) — URL, anon key,
  service role key, DB password. CLI is linked; the initial schema migration is
  pushed and live, and the full dip-chart catalog seed
  (`supabase/seed/dip_charts_seed.sql`) has been run (293 tank_types, 38,366
  dip_chart_points). Note: `supabase link` state lives in the untracked
  `supabase/.temp/` — it's per-checkout, so re-run `supabase link` if working
  from a fresh clone or a different worktree.
