# Fuel Dip Calculator — Design Spec

## Purpose

Fuel delivery drivers currently carry a paper "Safe Discharge Sheet" and a 327-page
dip-chart PDF, and do the opening/closing dip → volume → ullage math by hand (or by
pasting numbers into an AI chat) before and after every drop. This app replaces both
with a small web tool: pick a tank type and safe-fill %, enter a dip reading, get the
volume and safe headroom instantly; after delivery, enter the closing dip and get the
delivered volume and reconciliation against the planned amount.

Business context: built as a second product under SRV Freight Inc, separate from
Detours (own repo, own users). Plan is to test privately first, then potentially
offer it to other fuel delivery companies (e.g. national carriers like Seaboard).

## Tech Stack

- **Frontend/Backend:** Next.js (TypeScript, App Router) — API routes for anything
  that needs to run server-side (e.g. seeding, admin actions)
- **Database & Auth:** Supabase (Postgres, Supabase Auth, Row Level Security)
- **Hosting:** Vercel
- **CI:** GitHub Actions — lint, type-check, unit tests on every push; build must
  pass before merge to main

v1 is a **plain responsive web app** — no PWA/offline support yet. The data model
is kept simple enough that offline support (service worker + local queue) can be
added later as a v2 without a schema rewrite. Drivers use it in the browser on
their phone; works great with signal, requires connectivity for now.

## Data Model

Two categories of data:

1. **Shared reference data** — the dip chart catalog. Not owned by any one company;
   describes physical tank models (manufacturer specs), so it's parsed once and
   reused by any future customer.
2. **Company-private data** — drivers and their saved calculations. Scoped by
   `company_id` so a future second customer (e.g. Seaboard) never sees SRV
   Freight's driver accounts or delivery records, and vice versa.

v1 deliberately has **no sites / tank-roster tables**. Earlier drafts of this design
included a `sites` → `site_tanks` hierarchy (a persistent registry of which tank type
lives at which customer location), but that requires upfront admin setup before any
driver can use the app. Cut for v1: drivers just pick a tank type + safe-fill %
directly, per calculation, with a lightweight free-text/dropdown location tag for
their own reference. The site/tank-roster registry can be reintroduced later if the
manual selection becomes a pain point.

### Tables

```sql
-- Shared reference data (not tenant-scoped)
tank_types (
  id, chart_number,       -- e.g. "015", "526" (matches "TANK TYPE #XXX" in the PDF)
  manufacturer,            -- e.g. "ZCL P86 DW", "DTE", "Clemmer Reservoir"
  capacity_liters,
  created_at
)

dip_chart_points (
  id, tank_type_id references tank_types,
  dip_cm,
  volume_liters,
  unique(tank_type_id, dip_cm)
)

-- Company-private data
companies (
  id, name, created_at
)

drivers (
  id references auth.users, company_id references companies, role -- 'driver' | 'admin'
)

dip_calculations (
  id, company_id references companies, driver_id references drivers,
  tank_type_id references tank_types,
  location_label text,              -- free-text/dropdown, no FK, driver's own reference
  safe_fill_pct numeric,             -- 0.90 or 0.95, chosen per calculation
  product_grade text,                -- e.g. "Regular", "Premium", "Diesel LSD"
  compartment_no text,
  -- mirrors the paper form's numbered fields exactly:
  safe_fill_liters numeric,          -- #1 = capacity_liters * safe_fill_pct
  before_dip_cm numeric, before_volume_liters numeric,      -- #2
  tank_will_hold_liters numeric,     -- #3 = #1 - #2
  planned_delivery_liters numeric,   -- #4 (driver input)
  after_dip_cm numeric, after_volume_liters numeric,        -- #5
  receipt_volume_liters numeric,     -- #6 = #5 - #2
  volume_difference_liters numeric,  -- #7 = #6 - #4
  diverted_to text, new_bol_no text, liters_retained numeric,
  driver_signature text,             -- typed name or signature image ref
  created_at, updated_at
)
```

RLS: `drivers`/`dip_calculations` filtered by `company_id` matching the
authenticated user's company. `tank_types`/`dip_chart_points` are readable by any
authenticated user (shared catalog), writable only by a seed script / admin.

## Data Ingestion (dip chart PDF → database)

The 327-page PDF (`FLT - DIPCHARTS (1) 2.pdf`) is real extractable text (confirmed via
`pdfplumber`), not scanned images — no OCR needed. Format per tank: a header line
(`TANK TYPE #XXX`, `<MANUFACTURER> CAPACITY <NNNN>`) followed by `dip_cm volume_L`
pairs, often laid out in multiple side-by-side columns per page.

One-time ETL script (`scripts/parse-dip-charts.ts` or a Python script, run once
locally, not part of the app runtime):

1. Extract text per page with `pdfplumber`, using word x/y-coordinates (not naive
   `extract_text()`) to correctly separate side-by-side columns — naive extraction
   was observed to jumble columns (e.g. capacity `30609` merged with the word `TANK`
   on one page).
2. Parse tank header → `tank_types` row.
3. Parse each `dip_cm volume_L` pair → `dip_chart_points` row.
4. Validate: max dip's volume should be close to the stated capacity; flag any tank
   where parsed data looks inconsistent for manual review before seeding.
5. Write a seed SQL file / run against Supabase directly.

## Driver Workflow

1. Driver logs in (Supabase Auth, simple email/password or magic link).
2. Driver adds one or more tank calculators to their current working session — one
   per tank they're servicing on this stop (commonly 2–4: e.g. 2x Regular, 1x
   Premium, 1x Diesel LSD). Each calculator is independent:
   - Pick tank type (from catalog, searchable by chart number/manufacturer/capacity)
   - Pick safe-fill % (90% or 95%)
   - Optionally set location label, product grade, compartment #
   - Enter **before-delivery dip** → app looks up/interpolates volume (#2), shows
     safe-fill limit (#1) and tank-will-hold (#3) instantly
   - Driver enters **planned delivery amount** (#4) → app warns loudly if #4 ≥ #3
     (would exceed safe fill), matching the paper form's "DELIVER ONLY IF..." rule
3. After the physical delivery, driver returns to each open calculator and enters
   the **after-delivery dip** → app computes volume (#5), receipt volume (#6), and
   volume difference vs. planned (#7).
4. Driver fills product-retain fields (diverted to / new BOL # / liters retained) and
   signs (typed name for v1; signature capture can be a fast follow).
5. Each tank's calculation saves as one `dip_calculations` row.
6. History: a flat, filterable list (by driver, date, location label, tank type) —
   no dashboards/reporting in v1.

## Error Handling & Safety Checks

- **Interpolation:** dip values between chart rows are linearly interpolated
  between the two nearest points.
- **Out-of-range dip:** negative, or above the tank's max charted dip, is rejected
  with a clear error rather than silently extrapolating.
- **Overfill warning:** if planned or actual delivered volume would push the tank
  past its safe-fill limit, show a prominent (not silently dismissible) warning.
- **Reversed dips:** closing dip < opening dip is flagged as a likely entry error
  rather than silently producing a negative delivered volume.

## Testing

Unit tests for the interpolation function and the full 7-field calculation chain,
using real historical readings as regression fixtures, e.g.:

- Tank #015 (50,009 L, ZCL FRP): opening dip 174cm → ~38,360 L; closing dip 194cm →
  ~42,700 L; delivered ≈ 4,340 L
- Tank #014 (35,000 L, ZCL FRP): opening dip 154cm → ~24,010 L; closing dip 196cm →
  ~30,810 L; delivered ≈ 6,800 L
- Tank #526 (46,540 L, CAE Fiberglass): opening dip 116 → 22,897; closing dip 172 →
  36,560; delivered = 13,663

These calculations are safety-relevant (overfill risk), so CI must run and pass
these tests before every deploy.

## Out of Scope for v1 (explicitly deferred)

- Offline/PWA support (service worker, local queue, background sync)
- Sites / tank-roster registry (persistent mapping of site → its tanks)
- Signature image capture (typed name only for v1)
- Reporting/analytics dashboards beyond a flat filterable history list
- Multi-company onboarding flows (schema supports it; onboarding UX doesn't exist yet)
