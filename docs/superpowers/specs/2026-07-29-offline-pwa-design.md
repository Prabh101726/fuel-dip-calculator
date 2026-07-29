# Offline PWA (Project 2) — Design

**Date:** 2026-07-29  
**Status:** Implemented on `main`  
**Brief:** [`docs/next-task-cursor.md`](../../next-task-cursor.md)

## Goal

Drivers can install the app, reopen after swipe-up with drafts intact, calculate
on tanks they’ve opened online at least once, and queue saves while offline.
History stays online-only. Dip math in `lib/dip-calculator/` is unchanged.

## Architecture

```
Online:  getUser → drivers + trialEndsAt → IDB session
         tank_types list (full) → picker
         selectTank → dip_chart_points → IDB charts write-through
         save → insert | network fail → outbox

Offline: getSession (local) + IDB session (+ trial gate)
         picker = cached charts only
         selectTank → IDB (+ stale-response guard)
         save → outbox (blocked if trial expired)
         reconnect/focus → refreshSession once on 401 → flush outbox
```

- **Service worker:** Serwist (`@serwist/next`). Precaches app shell +
  `/calculator` + `/~offline`. Runtime: `defaultCache` plus **NetworkOnly** for
  Supabase hosts — never cache API responses in the SW.
- **IndexedDB (`idb`):** stores `charts`, `session`, `drafts`, `outbox`.
- **Drafts:** debounced 4-slot autosave **after** boot restore completes
  (`draftsReadyRef`); restore on calculator mount. Persist must not arm during
  the online boot network round-trips or blanks clobber IDB.
- **Outbox:** ordered flush; network keeps pending; 4xx/validation → `failed`
  (poison); 401 → refresh once and retry. Classifier uses Postgrest `message` /
  `code` (not HTTP status — postgrest-js does not expose status on errors).
- **Precache:** `/~offline` only — do **not** precache `/calculator` (auth
  redirect can poison the cache key with login HTML).

## Required amendments (A1–A5)

| ID | Behavior |
| --- | --- |
| A1 | Offline boot in `CalculatorClient`: local session, cached driver/company, cached tanks only |
| A2 | Cache `trial_ends_at`; gate calculator offline; no new outbox if expired |
| A3 | `selectedTankIdRef` + `isStaleTankPointsResponse` on IDB chart path |
| A4 | Poison / dead-letter for non-network flush failures |
| A5 | Flush after reconnect/focus with one auth refresh retry |

## Out of scope

Stripe, offline History, prefetch entire catalog, Background Sync–only flush,
changing dip math, caching Supabase REST in the SW.
