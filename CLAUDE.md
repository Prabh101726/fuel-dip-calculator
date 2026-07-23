# Fuel Dip Calculator — Agent Guide

Second product under SRV Freight Inc, separate from Detours (own repo, own users).
Replaces a paper "Safe Discharge Sheet" + a 327-page dip-chart PDF that fuel
delivery drivers currently do by hand: pick a tank type + safe-fill %, enter a dip
reading, get volume + safe headroom instantly; after delivery, enter the closing
dip and get delivered volume + reconciliation.

**Stack:** Next.js (TypeScript, App Router) · Supabase (Postgres, Auth, RLS) ·
Vercel · GitHub Actions CI (lint, type-check, unit tests on every push).

**Status:** Foundation phase complete and merged to `main` (Jul 23 2026) — Next.js
scaffold, CI, the calculation library, the Supabase schema (pushed to the live
project), and the PDF→seed-data pipeline are all built and tested. Driver-facing
UI, Supabase Auth wiring, and actually running the seed against the live database
are NOT started — that's the next phase. Read
`docs/superpowers/specs/2026-07-23-fuel-dip-calculator-design.md` before writing
any code — it is the source of truth for the data model, driver workflow, and
what's explicitly out of scope for v1. The implementation plan for the completed
foundation phase is at
`docs/superpowers/plans/2026-07-23-foundation-scaffold-schema-parser.md`.

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
  (transaction-wrapped) is generated and committed but **has not been run
  against the live database** — that's a deliberate, separately-confirmed step,
  not automatic.
- CI (`.github/workflows/ci.yml`): lint, typecheck, test, build on every push.

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
  pushed and live. The dip-chart catalog seed (`supabase/seed/dip_charts_seed.sql`)
  is generated but has NOT been run against it yet.
