# Next Task for Cursor — Login + Single-Tank Driver Calculator Flow

Context for Cursor — fuel-dip-calculator, next phase after Foundation.

Repo: `~/dev/fuel-dip-calculator` (also `https://github.com/Prabh101726/fuel-dip-calculator`), `main` branch, CI green.

## What's already built (don't rebuild, reuse)

- `lib/dip-calculator/interpolate.ts` — `interpolateVolume(points: DipChartPoint[], dipCm: number): number`, throws `DipOutOfRangeError` if `dipCm` is outside the chart's range. Do not extrapolate around this — always let it throw and show the error.
- `lib/dip-calculator/calculate.ts`:
  - `calculateBeforeDelivery({ tankPoints, capacityLiters, safeFillPct, beforeDipCm, plannedDeliveryLiters }) → { safeFillLiters, beforeVolumeLiters, tankWillHoldLiters, overfillWarning }`
  - `calculateAfterDelivery({ tankPoints, safeFillLiters, beforeDipCm, beforeVolumeLiters, plannedDeliveryLiters, afterDipCm }) → { afterVolumeLiters, receiptVolumeLiters, volumeDifferenceLiters, reversedDipWarning, overfillWarning }`
  - These are the safety-critical #1-#7 calculation chain from the paper form. Never reimplement this math in a component — always call these functions.
- `lib/dip-calculator/types.ts` — `DipChartPoint { dipCm, volumeLiters }`.
- Supabase schema is live (project ref `oxxmcdtafnvnkbojnrgx`, credentials in `.env.local`): `companies`, `drivers` (id references `auth.users`, has `company_id`, `role`), `tank_types` (chart_number, manufacturer, capacity_liters — shared catalog, read-only to authenticated users via RLS), `dip_chart_points` (tank_type_id, dip_cm, volume_liters), `dip_calculations` (the full #1-#7 row — see `supabase/migrations/20260723120000_initial_schema.sql` for exact columns).
- Full design spec (driver workflow, error handling rules, what's out of scope): `docs/superpowers/specs/2026-07-23-fuel-dip-calculator-design.md`.

## Real gap to know about before you design the login screen

There is no self-signup flow and no INSERT policy on `companies`/`drivers` for regular users — a `companies` row and a matching `drivers` row (with `id` = the corresponding `auth.users.id`) currently have to be created by hand (Supabase dashboard or service-role script) before a driver can log in. Don't build a signup UI yet — just a login screen (email/password via Supabase Auth) against a pre-provisioned account, and surface a clear error if login succeeds but no matching `drivers` row exists.

## Also know

`supabase/seed/dip_charts_seed.sql` (293 real tanks) has been generated but **not yet run** against the live database — `tank_types`/`dip_chart_points` are currently empty. You'll need at least one tank seeded to test against (either run that seed file, or insert one test tank type + a handful of dip/volume points by hand for local dev — ask the user before running the full seed against the live project, since it's ~300 records).

## Task: build the login screen + the single-tank driver calculator flow (steps 1-5 of the Driver Workflow section in the design spec)

1. Add `@supabase/supabase-js` + `@supabase/ssr`, set up a browser client and a server client following current Supabase Next.js App Router conventions (`createBrowserClient`/`createServerClient`, cookie handling for the App Router).
2. Login screen: email/password against Supabase Auth. On success, look up the `drivers` row for the logged-in user; if none exists, show a clear "no driver account found" error rather than a raw Supabase error.
3. One driver-facing screen for a single tank calculator (v1 — don't build multi-simultaneous-calculator management yet, that's a fast-follow):
   - Tank type picker: search `tank_types` by chart_number/manufacturer/capacity (it's a small shared read-only table, RLS already allows `select` for authenticated users).
   - Safe-fill % choice (90% or 95%), optional location label / product grade / compartment #.
   - Before-delivery dip input → call `calculateBeforeDelivery`, show `safeFillLiters` (#1), `beforeVolumeLiters` (#2), `tankWillHoldLiters` (#3) immediately.
   - Planned delivery amount input (#4) → show the `overfillWarning` from `calculateBeforeDelivery` as a **prominent, non-dismissible** warning if true (per spec — this is a real spill-risk warning, not a toast that auto-hides).
   - After-delivery dip input → call `calculateAfterDelivery`, show #5-#7, plus `reversedDipWarning` and its own `overfillWarning` equally prominently if true.
   - Diverted-to / new BOL # / liters-retained fields, typed-name signature field (no signature image capture in v1, per spec).
   - Save → insert one row into `dip_calculations` with `driver_id`/`company_id` from the session, mapping every field 1:1 to the migration's column names.
4. A minimal flat history list (own calculations only, RLS already enforces this) — no filtering/dashboards yet, per spec's out-of-scope list.

## Testing

Keep `lib/dip-calculator/` untouched and don't duplicate its logic in components. If you add new pure logic (e.g. a mapper from calc results to a `dip_calculations` insert payload), add Vitest tests for it next to the file, following the existing test file conventions in `lib/dip-calculator/*.test.ts`. Run `npm run lint && npm run typecheck && npm run test && npm run build` before considering it done — that's what CI checks.
