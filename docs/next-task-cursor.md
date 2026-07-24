# Next Task for Cursor — Multi-Tank Session (4 Tabs) + Clear Button

Context for Cursor — fuel-dip-calculator, fast-follow after the login/trial/
single-tank calculator phase (already live in production).

Repo: `~/dev/fuel-dip-calculator` (`https://github.com/Prabh101726/fuel-dip-calculator`), `main` branch, CI green.

## Why

Real-world gas stations typically have 3-4 underground tanks. Right now
`/calculator` only handles one tank at a time — a driver arriving at a station
with 4 tanks has to finish one tank's entire before/after flow, save, then
start over from a blank screen for the next tank. They want to record all the
**opening (before-delivery) dips together** across every tank at the station,
then come back and do the after-delivery dips per tank whenever it's
convenient — not forced into one tank at a time. There's also no way to reset
a single calculation and redo it without a full page reload.

This was explicitly deferred in the original task brief ("v1 — don't build
multi-simultaneous-calculator management yet, that's a fast-follow") — this is
that fast-follow.

## What's already built (don't rebuild, reuse)

Read `app/calculator/CalculatorClient.tsx` in full before starting — it's the
single component being refactored. Everything in it today (tank picker,
safe-fill %, before/after dip fields + results, warnings, retain/signature
fields, save-to-`dip_calculations`) stays exactly as-is *logically* — this task
is about running **4 independent copies of that flow side by side as tabs**,
not changing the calculation logic.

- `lib/dip-calculator/calculate.ts` — `calculateBeforeDelivery` /
  `calculateAfterDelivery`. Do not touch.
- `lib/dip-calculations/toInsertPayload.ts` — maps one tank's calc result to
  one `dip_calculations` insert row. Do not touch — each tab still inserts its
  own independent row; there's no session/grouping concept in the schema and
  none is needed for this task.
- `dip_calculations` already stores `tank_type_id` per row — no migration
  needed. Do not add a "session" table for this.

## Task: split `CalculatorClient` into a shared shell + 4 tab slots

1. **Extract the per-tank form** (tank picker through save button — everything
   currently in `CalculatorClient` below the `<header>`) into a new component,
   e.g. `app/calculator/TankSlot.tsx`. It owns all the state that's currently
   local to `CalculatorClient` per tank: `selectedTank`, `tankPoints`,
   `pointsLoading`/`pointsError`, `safeFillPct`, `locationLabel`,
   `productGrade`, `compartmentNo`, `beforeDipCm`, `plannedDeliveryLiters`,
   `afterDipCm`, `divertedTo`, `newBolNo`, `litersRetained`,
   `driverSignature`, `saveError`, `saving`. Props in: `tanks` list,
   `driverId`, `companyId`, `supabase` client (all lifted to the parent so
   they're fetched/created once, not once per tab).

2. **`CalculatorClient` becomes the shell:**
   - Keeps the existing auth check, driver/company lookup, and the one-time
     `tank_types` fetch (used by all 4 tabs — don't refetch per tab).
   - Renders 4 always-visible tabs, labeled "Tank 1"–"Tank 4" — once a tab has
     a tank selected, prefer showing that tank's chart number instead (e.g.
     "#526") so the driver can tell tabs apart at a glance. Active tab is
     visually distinct (reuse the existing `--accent` styling pattern already
     used for the safe-fill % toggle).
   - Renders all 4 `<TankSlot>` instances simultaneously but only the active
     tab's is visible (e.g. `hidden` class / `display: none` on the inactive
     ones) — **do not conditionally unmount inactive tabs**. State must
     persist when switching tabs, since the whole point is entering all 4
     opening dips before circling back for afters.
   - Keep the `history` link / logout button in the header as-is.

3. **Add a "Clear" button** in each `TankSlot`, next to the "Save calculation"
   button. Resets that slot's state back to its initial blank values (same
   defaults as a freshly mounted slot: no tank selected, empty fields,
   `safeFillPct` back to `0.9`). Only clears that one tab — the other 3 are
   untouched.

4. **Change post-save behavior.** Today, saving redirects to `/history`
   (`router.push("/history")`). Change this: on successful save, clear the
   slot back to blank (same reset as the Clear button) and show a small inline
   "Saved ✓" confirmation instead of navigating away — the driver likely has
   more tanks to do in the same visit. Do **not** remove the `/history` link
   from the header; that's still how they check past saves when they want to.

## Out of scope (don't build)

- No new Supabase tables/columns, no "session" or "visit" grouping concept.
- No cross-tab validation (e.g. warning if the same tank is picked in two
  tabs) — out of scope for this pass.
- No persisting tab state across a page reload/navigation — in-memory only,
  same as today's single-tank flow.
- Don't touch `/history` or the login/trial flow.

## Testing

Keep `lib/dip-calculator/` and `lib/dip-calculations/` untouched. Run
`npm run lint && npm run typecheck && npm run test && npm run build` before
considering it done — that's what CI checks. If you add any new pure
logic (e.g. a shared "blank slot state" factory), it doesn't need new tests
unless it does real computation — pure UI-state resets don't need Vitest
coverage, but do a manual click-through of all 4 tabs + Clear + Save to
confirm state isolation before calling it done.
