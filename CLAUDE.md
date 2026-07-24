# Fuel Dip Calculator — Agent Guide

Second product under SRV Freight Inc, separate from Detours (own repo, own users).
Replaces a paper "Safe Discharge Sheet" + a 327-page dip-chart PDF that fuel
delivery drivers currently do by hand: pick a tank type + safe-fill %, enter a dip
reading, get volume + safe headroom instantly; after delivery, enter the closing
dip and get delivered volume + reconciliation.

**Stack:** Next.js (TypeScript, App Router) · Supabase (Postgres, Auth, RLS) ·
Vercel · GitHub Actions CI (lint, type-check, unit tests on every push).

**Status:** Foundation phase, driver-facing phase, and a multi-tank fast-follow
(all Jul 23-24 2026) merged to `main` and **live in production**:
https://fuel-dip-calculator.vercel.app (Vercel project `detours/fuel-dip-calculator`).
Email/password login (see below — replaced magic-link the same day it shipped),
a 14-day trial with auto-provisioned company/driver on first login/signup, a
**4-tab multi-tank calculator** screen, and a flat history list are all built
and deployed. Read
`docs/superpowers/specs/2026-07-23-fuel-dip-calculator-design.md` for the
original v1 data model/workflow spec — **note the auth model has since
diverged from it twice**: the spec assumed simple email/password with no
self-signup; the first shipped version used magic-link + auto-provisioning +
trial gating instead (user-approved); Cursor then replaced magic-link with
password auth the same day (sign-in + create-account forms, still calling
`ensure_trial_driver()` on first signup) — password auth is what's actually
live now. The foundation implementation plan is at
`docs/superpowers/plans/2026-07-23-foundation-scaffold-schema-parser.md`.

**Still open / manual steps pending:**
- Vercel **Preview** environment env vars (`NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`) are NOT set — only Production is. A CLI bug
  in agent/non-interactive mode blocked adding them for "all preview
  branches"; add via Vercel dashboard → Settings → Environment Variables, or
  retry with an updated `vercel` CLI (`npm i -g vercel@latest`, needs sudo
  here).
- Supabase Auth redirect allow-list needs
  `https://fuel-dip-calculator.vercel.app/auth/callback` added by hand
  (Supabase Dashboard → Authentication → URL Configuration) — deliberately
  NOT pushed via `supabase config push`, since that would send the whole
  local `config.toml` (including local-dev `site_url`) to the live project
  and could clobber auth settings configured directly in the dashboard.
- Signature capture (image, not typed name), paid billing beyond the trial
  clock, and history filtering are still explicitly deferred (see
  `docs/next-task-cursor.md`'s Out of Scope section — now describing the
  multi-tank task, superseding the single-tank brief it replaced).

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
  first login/signup only, 14-day trial via `companies.trial_ends_at`).
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
might still have). The Supabase Auth redirect allow-list step in "Still open"
above is no longer needed for this flow specifically, but leave it — other
auth code paths (`/auth/callback`) still exist and email confirmation may use
it depending on dashboard settings.

## Multi-tank calculator (Jul 24 2026)

Real gas stations typically have 3-4 tanks; drivers wanted to enter all
opening (before-delivery) dips together, then come back per tank for the
after-delivery dip — not forced through one tank start-to-finish before
starting the next. Shipped as a fast-follow (commit `293de00`) to the
single-tank v1 that had explicitly deferred this:

- `CalculatorClient.tsx` is now a thin shell: auth/driver/company lookup, one
  shared `tank_types` fetch (not refetched per tab), a 4-button tab bar
  (`SLOT_COUNT = 4`, always visible, labeled `Tank 1`-`Tank 4` until a tank is
  picked, then the tank's chart number e.g. `#526`), and mounts all 4
  `<TankSlot>` instances simultaneously — inactive ones are hidden via CSS
  (`hidden`/`aria-hidden`), **never unmounted**, so each tab's state (selected
  tank, dip inputs, results) survives switching tabs. This is the load-bearing
  bit — don't refactor tab-switching to conditionally mount/unmount, it would
  silently wipe a driver's in-progress entry on another tab.
- `app/calculator/TankSlot.tsx` — the actual single-tank form (tank picker,
  safe-fill %, before/after dip fields + results, warnings, retain/signature
  fields, save), extracted verbatim from the old `CalculatorClient` — the
  calculation logic itself (`calculateBeforeDelivery`/`calculateAfterDelivery`)
  was **not** touched. Still inserts one independent row per tank into
  `dip_calculations` — no "session"/"visit" grouping concept exists or is
  needed, since the schema already keys per-calculation on `tank_type_id`.
  Reports its selected chart number up to the shell via
  `onSelectedChartChange` for the tab label.
- **Clear button** next to Save resets only that slot's own state
  (`resetSlot()`) back to blank defaults — doesn't touch the other 3 tabs.
- **Save no longer redirects to `/history`.** On successful save, the slot
  calls `resetSlot()` and shows a 2.5s "Saved ✓" flash (`savedFlash` state)
  instead, so the driver stays on the calculator to do the next tank. The
  `History` link in the header is unchanged for whenever they want to review
  past saves.

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
- **v1 is a plain responsive web app, no offline/PWA.** The schema is meant to
  support adding an offline queue later without a rewrite — keep it that way, but
  don't build the offline layer itself until asked.

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
