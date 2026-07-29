# Next Task for Cursor — Offline PWA (Project 2)

Amended brief after plan review (Jul 29 2026). Cursor’s architecture is
**approved**; **A1–A5 below are required** — A1 is a hard blocker (without it
the app does not work offline).

Repo: `~/dev/fuel-dip-calculator` (`https://github.com/Prabh101726/fuel-dip-calculator`),
`main` branch. Soft-launch tag **v0.2.0**. Do **not** change `lib/dip-calculator/`.

## Locked decisions

| Topic | Choice |
| --- | --- |
| Ship style | All-at-once (install + drafts + used-tank charts + offline calc + save queue) |
| Chart cache | Only tanks the driver has opened **online** at least once |
| Auth | Must have signed in while **online** first; no anonymous offline calculator |
| History | **Online only** — do not build offline history |
| Drafts | Survive swipe-up / kill (IndexedDB), restore on remount |
| Tech | Serwist (`@serwist/next`) + IndexedDB via `idb` |
| SW caching | App shell only — **do not** cache Supabase API responses in the SW |

## Architecture (approved)

- Serwist service worker + web app manifest (standalone, icons under `public/`)
- IndexedDB stores: `charts`, `drafts`, `outbox` (+ small `session`/meta for boot — see A1/A2)
- Write-through chart cache on successful online `dip_chart_points` load
- Debounced draft autosave; clear per-slot on Save / Clear
- Offline/online banner + pending outbox count
- History page unchanged (needs network)

```
Online:  Auth + drivers + tank_types + points → IDB write-through
Offline: getSession + IDB driver/meta + cached tanks only → calc
Save:    online insert | else outbox → flush on reconnect (after session refresh)
```

## Code verified (do not regress)

- `app/calculator/CalculatorClient.tsx` mount: `getUser` → drivers → full
  `tank_types` fetch — **all network today**; must become offline-aware (A1).
- `app/calculator/TankSlot.tsx` `selectTank`: fetches points; **keep**
  `selectedTankIdRef` + `isStaleTankPointsResponse` (safety-critical, `c6c012a`).
- Trial gate `my_trial_ends_at` only in `lib/supabase/middleware.ts` — **does
  not run** when SW serves cached shell offline → need client gate (A2).
- Save: `toInsertPayload()` → `dip_calculations` insert — reuse as outbox body.
- `app/calculator/page.tsx` `dynamic({ ssr: false })` is fine with Serwist.

---

## Required amendments (A1–A5)

### A1 — BLOCKER: Offline boot sequence

Cursor must **not** only offline-enable `selectTank`. Make
`CalculatorClient` mount offline-aware:

1. **Session:** When offline (or network fails), use
   `supabase.auth.getSession()` (local) instead of treating `getUser()` failure
   as “logged out → `/login`”. When online, keep `getUser()` verification.
2. **Driver/company:** After each successful online drivers lookup, cache
   `{ driverId, companyId }` in IDB. When offline, read from IDB. If missing →
   show “Connect once while online to use offline” (do not bounce to login if
   session exists but cache empty — clear message).
3. **Tank list:** Cache tank **metadata** (`id`, `chart_number`,
   `manufacturer`, `capacity_liters`) in the charts store **with** points.
   Offline picker lists **only cached tanks** (matches used-tanks-only).
   `capacity_liters` is required for `calculateBeforeDelivery`.

### A2 — Offline trial gate

- While online, fetch `trial_ends_at` once (e.g. `my_trial_ends_at` RPC) and
  cache it in IDB with driver meta.
- When offline, if `trial_ends_at <= now`, block calculator (same UX intent as
  `/trial-ended`) and **do not accept new outbox saves**.
- Rationale: middleware never runs on SW-served pages; RLS does not yet enforce
  trial (Jul 26 audit). Without A2, expired trials get unlimited offline use
  and queued saves would sync later.

### A3 — Stale-response guard on IDB path

Offline/async IDB chart reads in `selectTank` **must** still go through
`selectedTankIdRef` + `isStaleTankPointsResponse` before applying points /
clearing loading. Same wrong-ullage race as network.

### A4 — Outbox poison-item handling

On flush, distinguish failures:

| Failure | Behavior |
| --- | --- |
| Network / timeout | Keep item; retry later |
| Server rejection (RLS, validation, 4xx) | Mark **failed / dead-letter**, surface to driver, **do not** block the in-order queue behind it forever |

Do **not** “keep + retry forever” for non-network errors.

### A5 — Flush ordering with session refresh

On reconnect / focus:

1. Let supabase-js session refresh settle (or attempt insert; on **401**
   refresh-and-retry **once**).
2. Then flush outbox in order (skipping/marking poison items per A4).

Drivers offline >1h often have an expired access token at flush time.

---

## Implementation checklist

1. **PWA shell** — Serwist, manifest, icons, register SW; precache app shell only.
2. **`lib/offline/`** — IDB schema + helpers: charts (meta+points), drafts,
   outbox, session/meta (`driverId`, `companyId`, `trialEndsAt`).
3. **A1 boot** — rewrite CalculatorClient mount path as above.
4. **A2** — cache + enforce `trialEndsAt` offline.
5. **Chart load** — online: fetch + write-through; offline: IDB + A3 guard;
   missing cache → “Open this tank once while online…”.
6. **Drafts** — debounce save 4-slot state; restore on mount; clear on Save/Clear.
7. **Outbox** — enqueue on network save failure; flush with A4 + A5; banner
   “Offline / Online · N pending”.
8. **Install hint** — short iOS Add to Home Screen / Android install affordance.
9. **Docs** — design spec under `docs/superpowers/specs/`, update `CLAUDE.md`,
   `README.md`, `SECURITY.md` when shipping.

## Out of scope

- Stripe / paid unlock
- Offline History
- Prefetch entire chart catalog
- Relying only on Background Sync API (use online/focus flush)
- Changing `lib/dip-calculator/` math
- Caching Supabase REST in the service worker

## Verification (definition of done)

**Unit**

- IDB helpers; outbox enqueue / flush / poison-item; draft serialize/restore;
  `isStaleTankPointsResponse` still covered.

**Manual E2E**

1. Sign in online → open a tank (caches meta+points) → airplane mode  
2. Full before/after calc on **cached** tank → Save → queued  
3. Un-cached tank → clear “open once online” error  
4. Reconnect → flush → row in History  
5. Swipe-up kill → reopen → all 4 slot drafts restored  
6. Expired-trial account → gated offline (A2); no new outbox accepts  

**Regression**

- Existing unit suite green (currently 29+ tests; do not break dip-calculator
  fixtures). No changes to `lib/dip-calculator/`.

## Review gate after Cursor ships

Re-review the diff against **A1–A5** (especially A1 boot path and A3 race
guard) before calling Project 2 done.
