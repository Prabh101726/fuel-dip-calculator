# Fuel Dip Calculator — Foundation (Scaffold, Schema, Calculation Core, PDF Parser) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Next.js app skeleton, the Supabase schema (with RLS), the safety-critical dip→volume calculation library (with tests), and a one-time PDF→database ETL pipeline for the 327-page dip chart catalog — everything needed before any driver-facing UI is built.

**Architecture:** A Next.js (TypeScript, App Router) app with a small, pure calculation library (`lib/dip-calculator/`) that has zero dependency on Supabase or React so it can be unit-tested in isolation. Supabase Postgres holds two data categories — a shared, RLS-readable dip-chart catalog and company-scoped driver/calculation data — created via a single migration. A standalone Python ETL script (outside the app runtime) parses the source PDF into JSON, flags anything that doesn't match the expected layout for manual review instead of guessing, and a second script turns the clean JSON into a seed SQL file.

**Tech Stack:** Next.js (TypeScript, App Router), Supabase (Postgres, Auth, RLS), Vercel (hosting, not configured in this plan), GitHub Actions CI, Vitest (TS unit tests), Python 3 + pdfplumber + pytest (one-time ETL, not part of the app runtime).

## Global Constraints

- These calculations are safety-critical: an overfill from a wrong ullage number is a real spill risk, not a cosmetic bug. The dip→volume interpolation and the 7-field calculation chain must have regression tests before anything depends on them.
- Two data categories, don't blur them: `tank_types`/`dip_chart_points` are shared reference data (not tenant-scoped). `companies`/`drivers`/`dip_calculations` are private per `company_id`.
- v1 has no `sites`/tank-roster registry — do not add one in this plan.
- v1 is a plain responsive web app, no offline/PWA — the schema should not preclude adding an offline queue later, but do not build the offline layer now.
- Repo lives at `~/dev/fuel-dip-calculator`; keep it out of `~/Desktop`/`~/Documents` (iCloud).
- Supabase project `fuel-dip-calculator`, ref `oxxmcdtafnvnkbojnrgx`, org SiteSync (`mmlgaplkkzoteackwuez`), region Canada (Central). Credentials are in `.env.local` (gitignored).
- CI must run lint, type-check, and unit tests on every push; build must pass before merge to main.
- Out of scope for this plan (do not build): driver-facing UI, Supabase Auth wiring, signature capture, history list, and actually running the generated seed SQL against the live database (that's a manual, reviewed step after this plan lands).

---

## File Structure

- `app/` — Next.js App Router scaffold (default pages from `create-next-app`, untouched beyond scaffolding in this plan)
- `lib/dip-calculator/types.ts` — shared `DipChartPoint` type
- `lib/dip-calculator/interpolate.ts` — `interpolateVolume()` + `DipOutOfRangeError`
- `lib/dip-calculator/interpolate.test.ts` — synthetic unit tests for interpolation
- `lib/dip-calculator/interpolate.regression.test.ts` — real, PDF-verified regression fixtures (tanks #015, #014, #526)
- `lib/dip-calculator/calculate.ts` — `calculateBeforeDelivery()` / `calculateAfterDelivery()` (the 7-field chain)
- `lib/dip-calculator/calculate.test.ts` — synthetic unit tests for the calculation chain
- `supabase/migrations/20260723120000_initial_schema.sql` — tables, `my_company_id()` helper, RLS policies
- `supabase/seed/dip_charts_seed.sql` — generated output of Task 9/10, not written by hand
- `.github/workflows/ci.yml` — lint, typecheck, test, build on every push
- `scripts/requirements.txt` — pinned Python deps for the ETL scripts
- `scripts/parse_dip_charts.py` — PDF → `scripts/output/{dip_charts.json,review_needed.json,parse_warnings.log}`
- `scripts/test_parse_dip_charts.py` — pytest unit tests using mocked word lists (no real PDF needed)
- `scripts/generate_seed_sql.py` — `dip_charts.json` → `supabase/seed/dip_charts_seed.sql`
- `scripts/test_generate_seed_sql.py` — pytest unit tests for SQL generation

---

### Task 1: Next.js App Scaffold

**Files:**
- Create: everything `create-next-app` generates (`app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `next-env.d.ts`)
- Modify: `.gitignore` (append Next.js-specific entries, keep existing content)
- Create: `vitest.config.ts`

**Interfaces:**
- Produces: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` — every later task and CI depend on these four script names existing.

The repo already has `CLAUDE.md`, `README.md`, `.env.local`, `.gitignore`, `docs/` at its root, so `create-next-app` will refuse to run directly in this directory (it only tolerates a small allow-list of existing files). Scaffold into a temp directory and merge instead.

- [ ] **Step 1: Scaffold into a temp directory**

```bash
npx --yes create-next-app@latest /tmp/fuel-dip-scaffold-tmp \
  --typescript --eslint --tailwind --app --no-src-dir \
  --import-alias "@/*" --use-npm --no-turbopack
```

- [ ] **Step 2: Copy generated files into the repo, without clobbering existing docs**

```bash
cd ~/dev/fuel-dip-calculator
rsync -a \
  --exclude='README.md' --exclude='.gitignore' \
  --exclude='node_modules/' --exclude='.git/' \
  /tmp/fuel-dip-scaffold-tmp/ ./
rm -rf /tmp/fuel-dip-scaffold-tmp
```

- [ ] **Step 3: Merge `.gitignore` (append, don't overwrite)**

Append to the existing `.gitignore`:

```
# Next.js
/out/
*.tsbuildinfo
next-env.d.ts

# Python ETL venv
.venv/
```

- [ ] **Step 4: Install dependencies and add Vitest**

```bash
npm install
npm install -D vitest
```

- [ ] **Step 5: Add `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
```

- [ ] **Step 6: Add `typecheck` and `test` scripts to `package.json`**

In the `"scripts"` block (alongside the `dev`/`build`/`start`/`lint` scripts `create-next-app` already added):

```json
"typecheck": "tsc --noEmit",
"test": "vitest run"
```

- [ ] **Step 7: Verify the scaffold builds and lints clean**

```bash
npm run lint
npm run typecheck
npm run build
```

Expected: all three exit 0. `npm run test` will report "no test files found" — expected, since Task 3 adds the first ones.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app (TypeScript, App Router, Tailwind, Vitest)"
```

---

### Task 2: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` from Task 1.

- [ ] **Step 1: Write the workflow**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test
      - run: npm run build
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add lint, typecheck, test, build workflow"
```

(This won't run until the repo has a GitHub remote with pushes — verify manually once the repo is pushed, not part of this task's automated verification.)

---

### Task 3: Calculation Core — Interpolation

**Files:**
- Create: `lib/dip-calculator/types.ts`
- Create: `lib/dip-calculator/interpolate.ts`
- Create: `lib/dip-calculator/interpolate.test.ts`

**Interfaces:**
- Produces: `DipChartPoint { dipCm: number; volumeLiters: number }`, `interpolateVolume(points: DipChartPoint[], dipCm: number): number`, `class DipOutOfRangeError extends Error` — consumed by Task 4 and Task 10.

- [ ] **Step 1: Write `types.ts`**

```typescript
export interface DipChartPoint {
  dipCm: number;
  volumeLiters: number;
}
```

- [ ] **Step 2: Write the failing tests**

```typescript
// lib/dip-calculator/interpolate.test.ts
import { describe, expect, it } from "vitest";
import { DipOutOfRangeError, interpolateVolume } from "./interpolate";

describe("interpolateVolume", () => {
  const points = [
    { dipCm: 100, volumeLiters: 10000 },
    { dipCm: 200, volumeLiters: 20000 },
    { dipCm: 300, volumeLiters: 32000 },
  ];

  it("returns the exact volume when the dip matches a chart point", () => {
    expect(interpolateVolume(points, 200)).toBe(20000);
  });

  it("linearly interpolates between two bracketing points", () => {
    expect(interpolateVolume(points, 150)).toBe(15000);
  });

  it("interpolates within a later, differently-sloped segment using its own bracket", () => {
    expect(interpolateVolume(points, 250)).toBe(26000);
  });

  it("throws DipOutOfRangeError below the charted range", () => {
    expect(() => interpolateVolume(points, 50)).toThrow(DipOutOfRangeError);
  });

  it("throws DipOutOfRangeError above the charted range", () => {
    expect(() => interpolateVolume(points, 350)).toThrow(DipOutOfRangeError);
  });

  it("works regardless of input ordering", () => {
    const shuffled = [points[2], points[0], points[1]];
    expect(interpolateVolume(shuffled, 150)).toBe(15000);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm run test`
Expected: FAIL — `Cannot find module './interpolate'`

- [ ] **Step 4: Write `interpolate.ts`**

```typescript
import type { DipChartPoint } from "./types";

export class DipOutOfRangeError extends Error {
  constructor(dipCm: number, minCm: number, maxCm: number) {
    super(`Dip ${dipCm}cm is outside the charted range ${minCm}cm-${maxCm}cm`);
    this.name = "DipOutOfRangeError";
  }
}

export function interpolateVolume(points: DipChartPoint[], dipCm: number): number {
  if (points.length === 0) {
    throw new Error("interpolateVolume: points array is empty");
  }

  const sorted = [...points].sort((a, b) => a.dipCm - b.dipCm);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  if (dipCm < min.dipCm || dipCm > max.dipCm) {
    throw new DipOutOfRangeError(dipCm, min.dipCm, max.dipCm);
  }

  const exact = sorted.find((p) => p.dipCm === dipCm);
  if (exact) {
    return exact.volumeLiters;
  }

  let lower = sorted[0];
  let upper = sorted[sorted.length - 1];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].dipCm < dipCm && sorted[i + 1].dipCm > dipCm) {
      lower = sorted[i];
      upper = sorted[i + 1];
      break;
    }
  }

  const ratio = (dipCm - lower.dipCm) / (upper.dipCm - lower.dipCm);
  return lower.volumeLiters + ratio * (upper.volumeLiters - lower.volumeLiters);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test`
Expected: PASS (6/6)

- [ ] **Step 6: Commit**

```bash
git add lib/dip-calculator/types.ts lib/dip-calculator/interpolate.ts lib/dip-calculator/interpolate.test.ts
git commit -m "feat: add dip-to-volume linear interpolation"
```

---

### Task 4: Calculation Core — 7-Field Calculation Chain

**Files:**
- Create: `lib/dip-calculator/calculate.ts`
- Create: `lib/dip-calculator/calculate.test.ts`

**Interfaces:**
- Consumes: `DipChartPoint`, `interpolateVolume` from Task 3.
- Produces: `calculateBeforeDelivery(input: BeforeDeliveryInput): BeforeDeliveryResult`, `calculateAfterDelivery(input: AfterDeliveryInput): AfterDeliveryResult` — consumed by any future driver-workflow UI (not built in this plan).

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/dip-calculator/calculate.test.ts
import { describe, expect, it } from "vitest";
import { calculateAfterDelivery, calculateBeforeDelivery } from "./calculate";

describe("calculateBeforeDelivery", () => {
  const tankPoints = [
    { dipCm: 100, volumeLiters: 10000 },
    { dipCm: 200, volumeLiters: 20000 },
    { dipCm: 300, volumeLiters: 30000 },
  ];

  it("computes the #1-#3 fields from capacity, safe-fill %, and before dip", () => {
    const result = calculateBeforeDelivery({
      tankPoints,
      capacityLiters: 50000,
      safeFillPct: 0.9,
      beforeDipCm: 150,
      plannedDeliveryLiters: 12000,
    });
    expect(result.safeFillLiters).toBe(45000); // #1
    expect(result.beforeVolumeLiters).toBe(15000); // #2
    expect(result.tankWillHoldLiters).toBe(30000); // #3
    expect(result.overfillWarning).toBe(false);
  });

  it("warns when the planned delivery would meet or exceed the tank's remaining capacity", () => {
    const result = calculateBeforeDelivery({
      tankPoints,
      capacityLiters: 50000,
      safeFillPct: 0.9,
      beforeDipCm: 150,
      plannedDeliveryLiters: 30000,
    });
    expect(result.overfillWarning).toBe(true);
  });
});

describe("calculateAfterDelivery", () => {
  const tankPoints = [
    { dipCm: 100, volumeLiters: 10000 },
    { dipCm: 200, volumeLiters: 20000 },
    { dipCm: 300, volumeLiters: 30000 },
  ];

  it("computes the #5-#7 fields from the after dip", () => {
    const result = calculateAfterDelivery({
      tankPoints,
      safeFillLiters: 45000,
      beforeDipCm: 150,
      beforeVolumeLiters: 15000,
      plannedDeliveryLiters: 12000,
      afterDipCm: 200,
    });
    expect(result.afterVolumeLiters).toBe(20000); // #5
    expect(result.receiptVolumeLiters).toBe(5000); // #6 = #5 - #2
    expect(result.volumeDifferenceLiters).toBe(-7000); // #7 = #6 - #4
    expect(result.reversedDipWarning).toBe(false);
    expect(result.overfillWarning).toBe(false);
  });

  it("flags a reversed dip when the after dip is less than the before dip", () => {
    const result = calculateAfterDelivery({
      tankPoints,
      safeFillLiters: 45000,
      beforeDipCm: 200,
      beforeVolumeLiters: 20000,
      plannedDeliveryLiters: 5000,
      afterDipCm: 150,
    });
    expect(result.reversedDipWarning).toBe(true);
  });

  it("flags an overfill when the actual after-volume exceeds the safe-fill limit", () => {
    const result = calculateAfterDelivery({
      tankPoints,
      safeFillLiters: 25000,
      beforeDipCm: 100,
      beforeVolumeLiters: 10000,
      plannedDeliveryLiters: 15000,
      afterDipCm: 300,
    });
    expect(result.overfillWarning).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test`
Expected: FAIL — `Cannot find module './calculate'`

- [ ] **Step 3: Write `calculate.ts`**

```typescript
import { interpolateVolume } from "./interpolate";
import type { DipChartPoint } from "./types";

export interface BeforeDeliveryInput {
  tankPoints: DipChartPoint[];
  capacityLiters: number;
  safeFillPct: number;
  beforeDipCm: number;
  plannedDeliveryLiters: number;
}

export interface BeforeDeliveryResult {
  safeFillLiters: number; // #1
  beforeVolumeLiters: number; // #2
  tankWillHoldLiters: number; // #3
  overfillWarning: boolean; // planned delivery (#4) >= #3
}

export function calculateBeforeDelivery(input: BeforeDeliveryInput): BeforeDeliveryResult {
  const safeFillLiters = input.capacityLiters * input.safeFillPct;
  const beforeVolumeLiters = interpolateVolume(input.tankPoints, input.beforeDipCm);
  const tankWillHoldLiters = safeFillLiters - beforeVolumeLiters;
  const overfillWarning = input.plannedDeliveryLiters >= tankWillHoldLiters;

  return { safeFillLiters, beforeVolumeLiters, tankWillHoldLiters, overfillWarning };
}

export interface AfterDeliveryInput {
  tankPoints: DipChartPoint[];
  safeFillLiters: number;
  beforeDipCm: number;
  beforeVolumeLiters: number;
  plannedDeliveryLiters: number;
  afterDipCm: number;
}

export interface AfterDeliveryResult {
  afterVolumeLiters: number; // #5
  receiptVolumeLiters: number; // #6 = #5 - #2
  volumeDifferenceLiters: number; // #7 = #6 - #4
  reversedDipWarning: boolean; // after dip < before dip
  overfillWarning: boolean; // actual after-volume exceeds the safe-fill limit
}

export function calculateAfterDelivery(input: AfterDeliveryInput): AfterDeliveryResult {
  const reversedDipWarning = input.afterDipCm < input.beforeDipCm;
  const afterVolumeLiters = interpolateVolume(input.tankPoints, input.afterDipCm);
  const receiptVolumeLiters = afterVolumeLiters - input.beforeVolumeLiters;
  const volumeDifferenceLiters = receiptVolumeLiters - input.plannedDeliveryLiters;
  const overfillWarning = afterVolumeLiters > input.safeFillLiters;

  return {
    afterVolumeLiters,
    receiptVolumeLiters,
    volumeDifferenceLiters,
    reversedDipWarning,
    overfillWarning,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test`
Expected: PASS (5/5 in this file, 11/11 total)

- [ ] **Step 5: Commit**

```bash
git add lib/dip-calculator/calculate.ts lib/dip-calculator/calculate.test.ts
git commit -m "feat: add 7-field before/after delivery calculation chain"
```

---

### Task 5: Supabase Schema Migration

**Files:**
- Create: `supabase/migrations/20260723120000_initial_schema.sql`

**Interfaces:**
- Produces: tables `companies`, `drivers`, `tank_types`, `dip_chart_points`, `dip_calculations`, function `my_company_id()` — consumed by Task 9/10's seed SQL and any future app code.

- [ ] **Step 1: Initialize the local Supabase project structure**

```bash
cd ~/dev/fuel-dip-calculator
supabase init
```

Expected: creates `supabase/config.toml` and an empty `supabase/migrations/` directory.

- [ ] **Step 2: Write the migration**

```sql
-- supabase/migrations/20260723120000_initial_schema.sql

-- Company-private data
create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table drivers (
  id uuid primary key references auth.users (id) on delete cascade,
  company_id uuid not null references companies (id) on delete restrict,
  role text not null default 'driver' check (role in ('driver', 'admin')),
  created_at timestamptz not null default now()
);

-- Shared reference data (not tenant-scoped)
create table tank_types (
  id uuid primary key default gen_random_uuid(),
  chart_number text not null unique,
  manufacturer text not null,
  capacity_liters numeric not null,
  created_at timestamptz not null default now()
);

create table dip_chart_points (
  id uuid primary key default gen_random_uuid(),
  tank_type_id uuid not null references tank_types (id) on delete cascade,
  dip_cm numeric not null,
  volume_liters numeric not null,
  unique (tank_type_id, dip_cm)
);

-- Company-private data (mirrors the paper "Safe Discharge Sheet" #1-#7 fields)
create table dip_calculations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete restrict,
  driver_id uuid not null references drivers (id) on delete restrict,
  tank_type_id uuid not null references tank_types (id) on delete restrict,
  location_label text,
  safe_fill_pct numeric not null check (safe_fill_pct in (0.90, 0.95)),
  product_grade text,
  compartment_no text,
  safe_fill_liters numeric not null, -- #1
  before_dip_cm numeric not null,
  before_volume_liters numeric not null, -- #2
  tank_will_hold_liters numeric not null, -- #3
  planned_delivery_liters numeric not null, -- #4
  after_dip_cm numeric,
  after_volume_liters numeric, -- #5
  receipt_volume_liters numeric, -- #6
  volume_difference_liters numeric, -- #7
  diverted_to text,
  new_bol_no text,
  liters_retained numeric,
  driver_signature text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Returns the calling user's company_id. security definer so RLS policies on
-- `drivers` itself don't recurse when this function reads from `drivers`.
create or replace function my_company_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select company_id from drivers where id = auth.uid();
$$;

alter table companies enable row level security;
alter table drivers enable row level security;
alter table tank_types enable row level security;
alter table dip_chart_points enable row level security;
alter table dip_calculations enable row level security;

-- Shared catalog: any authenticated user can read; only service_role (bypasses
-- RLS) can write, via the seed script.
create policy "tank_types readable by authenticated"
  on tank_types for select to authenticated using (true);

create policy "dip_chart_points readable by authenticated"
  on dip_chart_points for select to authenticated using (true);

-- Company-private data, scoped by my_company_id()
create policy "companies read own"
  on companies for select to authenticated using (id = my_company_id());

create policy "drivers read own company"
  on drivers for select to authenticated using (company_id = my_company_id());

create policy "dip_calculations read own company"
  on dip_calculations for select to authenticated using (company_id = my_company_id());

create policy "dip_calculations insert own"
  on dip_calculations for insert to authenticated
  with check (company_id = my_company_id() and driver_id = auth.uid());

create policy "dip_calculations update own"
  on dip_calculations for update to authenticated
  using (company_id = my_company_id() and driver_id = auth.uid());
```

- [ ] **Step 3: Commit**

```bash
git add supabase/config.toml supabase/migrations/20260723120000_initial_schema.sql supabase/.gitignore
git commit -m "feat: add initial Supabase schema with RLS"
```

---

### Task 6: Link Supabase Project & Apply Migration

**Files:**
- None created — this task runs commands against the already-provisioned Supabase project referenced in `.env.local`.

**Interfaces:**
- Consumes: migration from Task 5, credentials from `.env.local` (`SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`).

- [ ] **Step 1: Link the CLI to the remote project**

```bash
cd ~/dev/fuel-dip-calculator
set -a; source .env.local; set +a
supabase link --project-ref "$SUPABASE_PROJECT_REF" --password "$SUPABASE_DB_PASSWORD"
```

Expected: `Finished supabase link.`

- [ ] **Step 2: Push the migration**

```bash
supabase db push
```

Expected: reports one migration applied (`20260723120000_initial_schema.sql`).

- [ ] **Step 3: Verify the tables exist**

```bash
supabase db push --dry-run
```

Expected: `No migrations to push` (confirms the remote is now in sync with the local migration).

- [ ] **Step 4: No commit needed** — nothing in the working tree changed; this task only mutates the remote database.

---

### Task 7: PDF Parser — Core Extraction Logic

**Files:**
- Create: `scripts/requirements.txt`
- Create: `scripts/parse_dip_charts.py`
- Create: `scripts/test_parse_dip_charts.py`

**Interfaces:**
- Produces: `clean_number`, `group_words_into_lines`, `split_header_and_data`, `parse_header`, `detect_anomalous_layout`, `parse_data_rows`, `TankRecord` — consumed by Task 8 (`parse_pdf`, `validate_tanks`, output writers) within the same file.

The source PDF (`~/Downloads/FLT - DIPCHARTS (1).pdf`, confirmed identical to the "(1) 2" copy via checksum) has real, non-scanned text but an inconsistent layout: most tank pages have 1-4 side-by-side `dip_cm volume_L` column pairs, multi-page tanks repeat their header as `TANK TYPE #131 1 OF 2` / `TANK TYPE #131 2 OF 2`, capacities and some volumes use comma thousands-separators (`14,700`), and a handful of pages (verified: page 99 uses feet/inch/cm/litres units, page 314 uses a triple `DIP/VOLUME/VOLUME@95%` layout, pages 312/316-324 are a "PCC # matches to FLT #" cross-reference index with no chart data, and page 326 has no chart number at all) don't match the standard layout and must be skipped and logged rather than guessed at.

- [ ] **Step 1: Set up the Python environment**

```bash
cd ~/dev/fuel-dip-calculator
python3 -m venv .venv
source .venv/bin/activate
```

- [ ] **Step 2: Write `requirements.txt`**

```
pdfplumber==0.11.10
pytest==8.3.3
```

```bash
pip install -r scripts/requirements.txt
```

- [ ] **Step 3: Write the failing tests**

```python
# scripts/test_parse_dip_charts.py
from parse_dip_charts import (
    TankRecord,
    clean_number,
    detect_anomalous_layout,
    group_words_into_lines,
    parse_data_rows,
    parse_header,
    split_header_and_data,
)


def word(text: str, x0: float, top: float) -> dict:
    return {"text": text, "x0": x0, "top": top}


class TestCleanNumber:
    def test_parses_plain_integer(self):
        assert clean_number("38209") == 38209.0

    def test_strips_thousands_comma(self):
        assert clean_number("14,700") == 14700.0

    def test_parses_decimal(self):
        assert clean_number("49449.13") == 49449.13

    def test_rejects_malformed_token(self):
        assert clean_number("38/117") is None


class TestGroupWordsIntoLines:
    def test_groups_words_at_same_y_into_one_line_sorted_by_x(self):
        words = [
            word("102", 331.6, 100.5),
            word("2", 215.7, 100.5),
            word("3982", 382.5, 100.5),
            word("15", 266.2, 100.5),
        ]
        lines = group_words_into_lines(words)
        assert len(lines) == 1
        assert [w["text"] for w in lines[0]] == ["2", "15", "102", "3982"]

    def test_separates_lines_more_than_tolerance_apart(self):
        words = [word("2", 215.7, 100.5), word("4", 215.7, 112.9)]
        lines = group_words_into_lines(words)
        assert len(lines) == 2


class TestSplitHeaderAndData:
    def test_splits_at_first_all_numeric_line(self):
        lines = [
            [word("TANK", 253.7, 59.5), word("TYPE", 289.9, 59.5), word("#002", 328.0, 59.5)],
            [word("DTE", 193.1, 75.4), word("CAPACITY", 314.6, 75.4), word("4621", 367.7, 75.4)],
            [word("2", 215.7, 100.5), word("15", 266.2, 100.5)],
        ]
        header, data = split_header_and_data(lines)
        assert len(header) == 2
        assert len(data) == 1

    def test_no_data_lines_returns_everything_as_header(self):
        lines = [[word("PCC", 100, 50), word("#996", 150, 50)]]
        header, data = split_header_and_data(lines)
        assert header == lines
        assert data == []


class TestParseHeader:
    def test_parses_standard_header(self):
        header_lines = [
            [word("TANK", 253.7, 59.5), word("TYPE", 289.9, 59.5), word("#015", 328.0, 59.5)],
            [word("ZCL", 100, 75.4), word("P86", 130, 75.4), word("CAPACITY", 250, 75.4), word("50000", 330, 75.4)],
        ]
        header = parse_header(header_lines)
        assert header["chart_number"] == "015"
        assert header["part_num"] == 1
        assert header["capacity_liters"] == 50000.0

    def test_parses_continuation_header(self):
        header_lines = [[
            word("TANK", 100, 50), word("TYPE", 130, 50), word("#131", 160, 50),
            word("2", 190, 50), word("OF", 200, 50), word("2", 220, 50),
        ]]
        header = parse_header(header_lines)
        assert header["chart_number"] == "131"
        assert header["part_num"] == 2

    def test_returns_none_when_no_tank_type_header_present(self):
        header_lines = [[word("PCC", 100, 50), word("#996", 150, 50), word("matches", 180, 50)]]
        assert parse_header(header_lines) is None


class TestDetectAnomalousLayout:
    def test_flags_triple_column_marker(self):
        header = {"raw_header": "TANK TYPE #1016 DIP VOLUME @ 95%"}
        reason = detect_anomalous_layout(header, [[word("1", 0, 0), word("2", 10, 0)]])
        assert reason is not None

    def test_flags_mostly_odd_length_rows(self):
        header = {"raw_header": "TANK TYPE #226"}
        data_lines = [
            [word("1", 0, 0), word("2", 10, 0), word("3", 20, 0)],
            [word("1", 0, 10), word("2", 10, 10), word("3", 20, 10)],
        ]
        reason = detect_anomalous_layout(header, data_lines)
        assert reason is not None

    def test_allows_standard_even_length_rows(self):
        header = {"raw_header": "TANK TYPE #015"}
        data_lines = [[word("2", 0, 0), word("99", 10, 0)]]
        assert detect_anomalous_layout(header, data_lines) is None


class TestParseDataRows:
    def test_pairs_consecutive_tokens_per_line(self):
        lines = [[word("2", 0, 0), word("99", 10, 0), word("102", 20, 0), word("19622", 30, 0)]]
        points = parse_data_rows(lines, page_num=13, warnings=[])
        assert points == [(2.0, 99.0), (102.0, 19622.0)]

    def test_drops_trailing_unpaired_token_with_warning(self):
        lines = [[word("2", 0, 0), word("99", 10, 0), word("102", 20, 0)]]
        warnings: list[str] = []
        points = parse_data_rows(lines, page_num=13, warnings=warnings)
        assert points == [(2.0, 99.0)]
        assert len(warnings) == 1

    def test_drops_malformed_pair_with_warning(self):
        lines = [[word("8", 0, 0), word("38/117", 10, 0)]]
        warnings: list[str] = []
        points = parse_data_rows(lines, page_num=325, warnings=warnings)
        assert points == []
        assert len(warnings) == 1
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `python3 -m pytest scripts/test_parse_dip_charts.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'parse_dip_charts'`

- [ ] **Step 5: Write `parse_dip_charts.py`**

```python
"""One-time ETL: parse the FLT dip-chart PDF into tank_types + dip_chart_points
data. Not part of the app runtime.

Run: python3 scripts/parse_dip_charts.py <pdf_path> <out_dir>
"""
from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass, field
from pathlib import Path

NUMERIC_TOKEN_RE = re.compile(r"^[\d,]+(\.\d+)?$")
HEADER_RE = re.compile(r"TANK TYPE #(\S+?)(?:\s+(\d+)\s+OF\s+(\d+))?(?:\s|$)")
CAPACITY_RE = re.compile(r"CAPACITY\s+([\d,]+(?:\.\d+)?)")
ANOMALY_MARKERS = ("VOLUME @", "ROOM")
CAPACITY_TOLERANCE = 0.03  # max charted volume must be within 3% of stated capacity
Y_TOLERANCE = 2.0  # points within this many pt of each other are the same visual line


@dataclass
class TankRecord:
    chart_number: str
    manufacturer: str
    capacity_liters: float
    points: list[tuple[float, float]] = field(default_factory=list)
    pages: list[int] = field(default_factory=list)


def clean_number(token: str) -> float | None:
    """Parse a raw PDF token like '38,209' or '49449.13' into a float.
    Returns None for malformed tokens (e.g. the '38/117' artifact on page 325)."""
    if not NUMERIC_TOKEN_RE.match(token):
        return None
    return float(token.replace(",", ""))


def group_words_into_lines(words: list[dict]) -> list[list[dict]]:
    """Cluster words by y-coordinate ('top') into visual lines, each sorted
    left-to-right by x0. Coordinate-aware, per the design spec, rather than
    trusting pdfplumber's own text-line reconstruction on multi-column pages."""
    sorted_words = sorted(words, key=lambda w: (w["top"], w["x0"]))
    lines: list[list[dict]] = []
    for w in sorted_words:
        if lines and abs(lines[-1][0]["top"] - w["top"]) <= Y_TOLERANCE:
            lines[-1].append(w)
        else:
            lines.append([w])
    for line in lines:
        line.sort(key=lambda w: w["x0"])
    return lines


def split_header_and_data(lines: list[list[dict]]) -> tuple[list[list[dict]], list[list[dict]]]:
    """A data line has >= 2 words and every word is a numeric token. Everything
    before the first data line is header."""
    for i, line in enumerate(lines):
        texts = [w["text"] for w in line]
        if len(texts) >= 2 and all(NUMERIC_TOKEN_RE.match(t) for t in texts):
            return lines[:i], lines[i:]
    return lines, []


def parse_header(header_lines: list[list[dict]]) -> dict | None:
    """Returns None if no 'TANK TYPE #...' header is found (e.g. a
    cross-reference index page, or a differently-formatted page like
    'DESERT OIL MANIWAKI TANK #226') — those are logged and skipped by the
    caller, never guessed at."""
    text = " ".join(w["text"] for line in header_lines for w in line)
    match = HEADER_RE.search(text)
    if not match:
        return None
    chart_number, part_num, _part_total = match.groups()
    cap_match = CAPACITY_RE.search(text)
    capacity = clean_number(cap_match.group(1)) if cap_match else None
    manufacturer = (text[: match.start()] + " " + text[match.end() :]).strip()
    manufacturer = CAPACITY_RE.sub("", manufacturer).strip(" -")
    return {
        "chart_number": chart_number,
        "part_num": int(part_num) if part_num else 1,
        "capacity_liters": capacity,
        "manufacturer": manufacturer or chart_number,
        "raw_header": text,
    }


def detect_anomalous_layout(header: dict, data_lines: list[list[dict]]) -> str | None:
    """Returns a skip reason if this tank's table doesn't match the standard
    2-values-per-column-group (dip, volume) layout. Two known cases in this
    document: a 'DIP VOLUME @ 95%' triple-column layout, and pages where most
    rows have an odd token count and can't be safely paired without risking
    silently mismatched dip/volume numbers."""
    if any(marker in header["raw_header"] for marker in ANOMALY_MARKERS):
        return f"header contains anomaly marker (one of {ANOMALY_MARKERS}); likely a non-standard column layout"
    if not data_lines:
        return "no data rows found"
    odd_lines = sum(1 for line in data_lines if len(line) % 2 != 0)
    if odd_lines / len(data_lines) > 0.5:
        return f"{odd_lines}/{len(data_lines)} data rows have an odd token count; layout doesn't match dip/volume pairs"
    return None


def parse_data_rows(data_lines: list[list[dict]], page_num: int, warnings: list[str]) -> list[tuple[float, float]]:
    points: list[tuple[float, float]] = []
    for line in data_lines:
        tokens = [w["text"] for w in line]
        if len(tokens) % 2 != 0:
            warnings.append(f"page {page_num}: dropping trailing unpaired token {tokens[-1]!r}")
            tokens = tokens[:-1]
        for i in range(0, len(tokens), 2):
            dip = clean_number(tokens[i])
            vol = clean_number(tokens[i + 1])
            if dip is None or vol is None:
                warnings.append(f"page {page_num}: dropping unparseable pair {tokens[i]!r}/{tokens[i + 1]!r}")
                continue
            points.append((dip, vol))
    return points
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `python3 -m pytest scripts/test_parse_dip_charts.py -v`
Expected: PASS (14/14)

- [ ] **Step 7: Commit**

```bash
git add scripts/requirements.txt scripts/parse_dip_charts.py scripts/test_parse_dip_charts.py
git commit -m "feat: add PDF dip-chart parser core extraction logic"
```

---

### Task 8: PDF Parser — Page Loop, Validation & Output Writers

**Files:**
- Modify: `scripts/parse_dip_charts.py` (append `parse_pdf`, `validate_tanks`, `write_outputs`, `main`)
- Modify: `scripts/test_parse_dip_charts.py` (append `TestValidateTanks`)

**Interfaces:**
- Consumes: everything from Task 7.
- Produces: `parse_pdf(pdf_path: str, warnings: list[str]) -> dict[str, TankRecord]`, `validate_tanks(tanks, warnings) -> tuple[dict[str, TankRecord], dict[str, str]]`, CLI entrypoint writing `dip_charts.json` / `review_needed.json` / `parse_warnings.log` — consumed by Task 9 (`generate_seed_sql.py` reads `dip_charts.json`) and Task 10 (runs this against the real PDF).

- [ ] **Step 1: Write the failing test for validation**

Append to `scripts/test_parse_dip_charts.py`:

```python
from parse_dip_charts import validate_tanks


class TestValidateTanks:
    def test_accepts_tank_within_capacity_tolerance(self):
        tanks = {"015": TankRecord("015", "ZCL", 50000.0, [(2, 99), (246, 50007)], [13])}
        good, flagged = validate_tanks(tanks, [])
        assert "015" in good
        assert flagged == {}

    def test_flags_tank_whose_max_volume_is_far_from_capacity(self):
        tanks = {"999": TankRecord("999", "MYSTERY", 10000.0, [(2, 50), (100, 5000)], [1])}
        good, flagged = validate_tanks(tanks, [])
        assert "999" not in good
        assert "999" in flagged

    def test_flags_tank_with_no_points(self):
        tanks = {"888": TankRecord("888", "EMPTY", 10000.0, [], [1])}
        good, flagged = validate_tanks(tanks, [])
        assert "888" in flagged
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python3 -m pytest scripts/test_parse_dip_charts.py -v`
Expected: FAIL — `ImportError: cannot import name 'validate_tanks'`

- [ ] **Step 3: Append `parse_pdf`, `validate_tanks`, `write_outputs`, `main` to `parse_dip_charts.py`**

Add `import pdfplumber` to the top imports, then append:

```python
def parse_pdf(pdf_path: str, warnings: list[str]) -> dict[str, TankRecord]:
    import pdfplumber

    tanks: dict[str, TankRecord] = {}
    last_chart_number: str | None = None
    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            words = page.extract_words()
            if not words:
                continue
            lines = group_words_into_lines(words)
            header_lines, data_lines = split_header_and_data(lines)
            header = parse_header(header_lines)
            if header is None:
                raw = " ".join(w["text"] for line in header_lines[:2] for w in line)
                warnings.append(f"page {page_num}: no 'TANK TYPE #...' header found, skipping. First words: {raw!r}")
                continue

            anomaly = detect_anomalous_layout(header, data_lines)
            if anomaly:
                warnings.append(f"page {page_num}: skipping tank #{header['chart_number']}: {anomaly}")
                continue

            if header["capacity_liters"] is None:
                warnings.append(f"page {page_num}: tank #{header['chart_number']} has no parseable CAPACITY, skipping")
                continue

            points = parse_data_rows(data_lines, page_num, warnings)
            chart_number = header["chart_number"]

            if chart_number in tanks:
                if header["part_num"] != 1 and chart_number != last_chart_number:
                    warnings.append(
                        f"page {page_num}: continuation page for #{chart_number} part {header['part_num']} "
                        f"doesn't immediately follow that tank's previous page, appending anyway"
                    )
                elif header["part_num"] == 1:
                    warnings.append(f"page {page_num}: duplicate chart_number #{chart_number}, merging into existing tank")
                tanks[chart_number].points.extend(points)
                tanks[chart_number].pages.append(page_num)
            else:
                tanks[chart_number] = TankRecord(
                    chart_number=chart_number,
                    manufacturer=header["manufacturer"],
                    capacity_liters=header["capacity_liters"],
                    points=points,
                    pages=[page_num],
                )

            last_chart_number = chart_number
    return tanks


def validate_tanks(tanks: dict[str, TankRecord], warnings: list[str]) -> tuple[dict[str, TankRecord], dict[str, str]]:
    good: dict[str, TankRecord] = {}
    flagged: dict[str, str] = {}
    for chart_number, tank in tanks.items():
        if not tank.points:
            flagged[chart_number] = "no dip/volume points parsed"
            continue
        if tank.capacity_liters <= 0:
            flagged[chart_number] = f"non-positive capacity {tank.capacity_liters}"
            continue
        max_volume = max(v for _, v in tank.points)
        relative_diff = abs(max_volume - tank.capacity_liters) / tank.capacity_liters
        if relative_diff > CAPACITY_TOLERANCE:
            flagged[chart_number] = (
                f"max charted volume {max_volume} is {relative_diff:.1%} off stated capacity {tank.capacity_liters}"
            )
            continue
        good[chart_number] = tank
    return good, flagged


def write_outputs(good: dict[str, TankRecord], flagged: dict[str, str], warnings: list[str], out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)

    good_json = {
        chart_number: {
            "manufacturer": tank.manufacturer,
            "capacity_liters": tank.capacity_liters,
            "points": tank.points,
            "pages": tank.pages,
        }
        for chart_number, tank in good.items()
    }
    (out_dir / "dip_charts.json").write_text(json.dumps(good_json, indent=2))
    (out_dir / "review_needed.json").write_text(json.dumps(flagged, indent=2))
    (out_dir / "parse_warnings.log").write_text("\n".join(warnings))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf_path")
    parser.add_argument("out_dir")
    args = parser.parse_args()

    warnings: list[str] = []
    tanks = parse_pdf(args.pdf_path, warnings)
    good, flagged = validate_tanks(tanks, warnings)
    write_outputs(good, flagged, warnings, Path(args.out_dir))

    print(f"Parsed {len(tanks)} tanks: {len(good)} good, {len(flagged)} flagged for review.")
    print(f"{len(warnings)} row/page-level warnings logged.")
    print(f"Output written to {args.out_dir}/")


if __name__ == "__main__":
    main()
```

Remove the now-redundant inner `import pdfplumber` from `parse_pdf` if you moved the top-level import instead — keep exactly one of the two.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python3 -m pytest scripts/test_parse_dip_charts.py -v`
Expected: PASS (17/17)

- [ ] **Step 5: Commit**

```bash
git add scripts/parse_dip_charts.py scripts/test_parse_dip_charts.py
git commit -m "feat: add PDF parser page loop, validation, and output writers"
```

---

### Task 9: Seed SQL Generator

**Files:**
- Create: `scripts/generate_seed_sql.py`
- Create: `scripts/test_generate_seed_sql.py`

**Interfaces:**
- Consumes: `dip_charts.json` shape produced by Task 8's `write_outputs` (`{chart_number: {manufacturer, capacity_liters, points, pages}}`).
- Produces: `supabase/seed/dip_charts_seed.sql`, matching the `tank_types`/`dip_chart_points` schema from Task 5.

- [ ] **Step 1: Write the failing tests**

```python
# scripts/test_generate_seed_sql.py
from generate_seed_sql import escape_sql_literal, generate_seed_sql, tank_to_sql


def test_escapes_single_quotes():
    assert escape_sql_literal("O'Brien") == "O''Brien"


def test_tank_to_sql_produces_cte_insert_pair():
    sql = tank_to_sql("015", {
        "manufacturer": "ZCL P86 DW",
        "capacity_liters": 50000.0,
        "points": [(2.0, 99.0), (4.0, 215.0)],
    })
    assert "INSERT INTO tank_types" in sql
    assert "'015'" in sql
    assert "INSERT INTO dip_chart_points" in sql
    assert "(2.0,99.0)" in sql


def test_generate_seed_sql_joins_multiple_tanks_with_blank_line():
    tanks = {
        "015": {"manufacturer": "ZCL", "capacity_liters": 50000.0, "points": [(2.0, 99.0)]},
        "014": {"manufacturer": "ZCL", "capacity_liters": 35000.0, "points": [(2.0, 65.0)]},
    }
    sql = generate_seed_sql(tanks)
    assert sql.count("WITH ins AS") == 2
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python3 -m pytest scripts/test_generate_seed_sql.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'generate_seed_sql'`

- [ ] **Step 3: Write `generate_seed_sql.py`**

```python
"""Generate a Supabase seed SQL file from the parsed dip-chart JSON produced
by parse_dip_charts.py.

Run: python3 scripts/generate_seed_sql.py scripts/output/dip_charts.json supabase/seed/dip_charts_seed.sql
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path


def escape_sql_literal(value: str) -> str:
    return value.replace("'", "''")


def tank_to_sql(chart_number: str, tank: dict) -> str:
    manufacturer = escape_sql_literal(tank["manufacturer"])
    capacity = tank["capacity_liters"]
    values = ",".join(f"({dip},{vol})" for dip, vol in tank["points"])
    return (
        "WITH ins AS (\n"
        "  INSERT INTO tank_types (chart_number, manufacturer, capacity_liters)\n"
        f"  VALUES ('{escape_sql_literal(chart_number)}', '{manufacturer}', {capacity})\n"
        "  RETURNING id\n"
        ")\n"
        "INSERT INTO dip_chart_points (tank_type_id, dip_cm, volume_liters)\n"
        f"SELECT id, v.dip_cm, v.volume_liters FROM ins, (VALUES {values}) AS v(dip_cm, volume_liters);"
    )


def generate_seed_sql(tanks_by_chart_number: dict[str, dict]) -> str:
    statements = [
        tank_to_sql(chart_number, tank)
        for chart_number, tank in sorted(tanks_by_chart_number.items())
    ]
    return "\n\n".join(statements) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input_json")
    parser.add_argument("output_sql")
    args = parser.parse_args()

    tanks = json.loads(Path(args.input_json).read_text())
    sql = generate_seed_sql(tanks)
    Path(args.output_sql).write_text(sql)
    print(f"Wrote {len(tanks)} tank INSERT statements to {args.output_sql}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python3 -m pytest scripts/test_generate_seed_sql.py -v`
Expected: PASS (3/3)

- [ ] **Step 5: Commit**

```bash
git add scripts/generate_seed_sql.py scripts/test_generate_seed_sql.py
git commit -m "feat: add seed SQL generator for parsed dip charts"
```

---

### Task 10: Run the Parser Against the Real PDF & Add Real-Data Regression Tests

**Files:**
- Create (generated, not hand-written): `scripts/output/dip_charts.json`, `scripts/output/review_needed.json`, `scripts/output/parse_warnings.log`
- Create: `supabase/seed/dip_charts_seed.sql` (generated)
- Create: `lib/dip-calculator/interpolate.regression.test.ts`
- Modify: `.gitignore` (add `scripts/output/`)

**Interfaces:**
- Consumes: `interpolateVolume` from Task 3, `parse_dip_charts.py` from Task 8, `generate_seed_sql.py` from Task 9.

This is the only task in the plan that touches the real, local-only source PDF — it does not run in CI. The PDF lives at `~/Downloads/FLT - DIPCHARTS (1).pdf` (verified identical, via `md5`, to the `(1) 2` copy also in Downloads).

- [ ] **Step 1: Ignore the generated JSON/log output (keep only the final SQL in git)**

Append to `.gitignore`:

```
scripts/output/
```

- [ ] **Step 2: Run the parser against the real PDF**

```bash
cd ~/dev/fuel-dip-calculator
source .venv/bin/activate
python3 scripts/parse_dip_charts.py "$HOME/Downloads/FLT - DIPCHARTS (1).pdf" scripts/output
```

Expected: prints a summary line, e.g. `Parsed N tanks: G good, F flagged for review.` The document has 327 pages with 12 known anomaly pages (1 continuation page that's expected to merge cleanly, 1 feet/inch/cm page, 9 "PCC # matches to FLT #" index pages, 1 page with no chart number, and possibly 1 triple-column page) — expect roughly that many entries logged in `parse_warnings.log`/`review_needed.json`, not zero.

- [ ] **Step 3: Read the review log and sanity-check it**

```bash
cat scripts/output/review_needed.json
wc -l scripts/output/parse_warnings.log
```

Confirm the flagged/skipped tanks match the known anomalies (feet/inch page, PCC index pages, etc.) rather than a broad swath of otherwise-normal tanks — a large number of unexpected flags would mean the layout assumptions in Task 7/8 don't hold for this PDF and need revisiting before trusting the output.

- [ ] **Step 4: Confirm the three spec regression tanks parsed cleanly**

```bash
python3 -c "
import json
data = json.load(open('scripts/output/dip_charts.json'))
for cn in ['015', '014', '526']:
    print(cn, data[cn]['capacity_liters'], len(data[cn]['points']))
"
```

Expected: all three present with the capacities from the design spec (50000, 35000, 46540).

- [ ] **Step 5: Generate the seed SQL**

```bash
python3 scripts/generate_seed_sql.py scripts/output/dip_charts.json supabase/seed/dip_charts_seed.sql
```

- [ ] **Step 6: Write the TypeScript regression test using the real, PDF-verified numbers**

These points are transcribed directly from the parsed PDF (tanks #015, #014, #526), bracketing the exact dip readings used as fixtures in the design spec's Testing section. Note: the #014 numbers below are the actual chart values and differ slightly (~2%) from the design spec's approximate recollection (`~24,010`/`~30,810`) — the chart is the authoritative source.

```typescript
// lib/dip-calculator/interpolate.regression.test.ts
import { describe, expect, it } from "vitest";
import { interpolateVolume } from "./interpolate";

describe("interpolateVolume: real dip-chart regression fixtures", () => {
  it("tank #015 (50,000 L, ZCL FRP): opening 174cm -> closing 194cm", () => {
    const points = [
      { dipCm: 170, volumeLiters: 37253 },
      { dipCm: 172, volumeLiters: 37733 },
      { dipCm: 174, volumeLiters: 38209 },
      { dipCm: 176, volumeLiters: 38681 },
      { dipCm: 178, volumeLiters: 39148 },
      { dipCm: 180, volumeLiters: 39609 },
      { dipCm: 190, volumeLiters: 41837 },
      { dipCm: 192, volumeLiters: 42264 },
      { dipCm: 194, volumeLiters: 42685 },
      { dipCm: 196, volumeLiters: 43099 },
      { dipCm: 198, volumeLiters: 43506 },
      { dipCm: 200, volumeLiters: 43906 },
    ];
    const before = interpolateVolume(points, 174);
    const after = interpolateVolume(points, 194);
    expect(before).toBe(38209);
    expect(after).toBe(42685);
    expect(after - before).toBe(4476);
  });

  it("tank #014 (35,000 L, ZCL FRP): opening 154cm -> closing 196cm", () => {
    const points = [
      { dipCm: 150, volumeLiters: 22632 },
      { dipCm: 152, volumeLiters: 22995 },
      { dipCm: 154, volumeLiters: 23356 },
      { dipCm: 156, volumeLiters: 23715 },
      { dipCm: 158, volumeLiters: 24072 },
      { dipCm: 160, volumeLiters: 24427 },
      { dipCm: 190, volumeLiters: 29379 },
      { dipCm: 192, volumeLiters: 29678 },
      { dipCm: 194, volumeLiters: 29972 },
      { dipCm: 196, volumeLiters: 30260 },
      { dipCm: 198, volumeLiters: 30544 },
      { dipCm: 200, volumeLiters: 30822 },
    ];
    const before = interpolateVolume(points, 154);
    const after = interpolateVolume(points, 196);
    expect(before).toBe(23356);
    expect(after).toBe(30260);
    expect(after - before).toBe(6904);
  });

  it("tank #526 (46,540 L, CAE Fiberglass): opening 116cm -> closing 172cm", () => {
    const points = [
      { dipCm: 112, volumeLiters: 21883 },
      { dipCm: 114, volumeLiters: 22390 },
      { dipCm: 116, volumeLiters: 22897 },
      { dipCm: 118, volumeLiters: 23404 },
      { dipCm: 120, volumeLiters: 23911 },
      { dipCm: 122, volumeLiters: 24417 },
      { dipCm: 168, volumeLiters: 35657 },
      { dipCm: 170, volumeLiters: 36111 },
      { dipCm: 172, volumeLiters: 36560 },
      { dipCm: 174, volumeLiters: 37005 },
      { dipCm: 176, volumeLiters: 37445 },
      { dipCm: 178, volumeLiters: 37880 },
    ];
    const before = interpolateVolume(points, 116);
    const after = interpolateVolume(points, 172);
    expect(before).toBe(22897);
    expect(after).toBe(36560);
    expect(after - before).toBe(13663);
  });
});
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm run test`
Expected: PASS, all files (14/14 total across `interpolate.test.ts`, `interpolate.regression.test.ts`, `calculate.test.ts`)

- [ ] **Step 8: Commit**

```bash
git add .gitignore lib/dip-calculator/interpolate.regression.test.ts supabase/seed/dip_charts_seed.sql
git commit -m "feat: run PDF parser against real dip charts, add real-data regression tests"
```

Do **not** run `supabase/seed/dip_charts_seed.sql` against the live database as part of this task — seeding ~300 tank records into the shared catalog is a one-way, hard-to-casually-reverse action on the real project and should be a deliberate, separately-confirmed step after reviewing `scripts/output/review_needed.json`.

---

## Self-Review Notes

- **Spec coverage:** Tech stack (Task 1), CI (Task 2), data model + RLS (Task 5-6), PDF ingestion pipeline including coordinate-aware parsing and validation/flagging (Task 7-9), regression tests from the spec's Testing section (Task 10), interpolation error handling / overfill / reversed-dip safety checks (Task 3-4). Driver workflow UI, Auth wiring, and the sites/tank-roster registry are explicitly out of scope per the spec and this plan's Global Constraints — left for a follow-up plan.
- **Real-data discrepancy flagged, not hidden:** tank #014's spec fixture numbers were approximate recollections; Task 10 uses the verified real chart values instead and calls out the ~2% difference inline.
