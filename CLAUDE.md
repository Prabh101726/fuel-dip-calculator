# Fuel Dip Calculator — Agent Guide

Second product under Detours Fleet Operations, separate from Detours (own repo,
own users).
Replaces a paper "Safe Discharge Sheet" + a 327-page dip-chart PDF that fuel
delivery drivers currently do by hand: pick a tank type + safe-fill %, enter a dip
reading, get volume + safe headroom instantly; after delivery, enter the closing
dip and get delivered volume + reconciliation.

**Stack:** Next.js (TypeScript, App Router) · Supabase (Postgres, Auth, RLS) ·
Vercel · GitHub Actions CI (lint, type-check, unit tests on every push).

**Status:** Foundation (Jul 23), driver-facing + password auth (Jul 23),
multi-tank calculator (Jul 24), **pre-production readiness (Jul 26)**,
**calculator form UX (Jul 28)**, **offline PWA / Project 2 (Jul 29)**,
**direct-to-driver Stripe billing (Jul 31)**, **soft-launch polish (Aug 1)**,
and **phone OTP login + subscribed UI (Aug 4)** are merged to `main` and
**live in production**:
https://fuel-dip-calculator.app (custom domain) /
https://fuel-dip-calculator.vercel.app (Vercel project `detours/fuel-dip-calculator`).
Live now: **phone OTP sign-in as the primary auth path** (+1 NANP, server-side
throttle; email login + forgot-password kept for legacy accounts only — no new
email signup in the UI), **7-day trial** for new companies (was 14-day at
launch — existing `trial_ends_at` not backfilled), auto-provisioned
company/driver on first verified sign-in, 4-tab multi-tank
calculator with **product-grade dropdown** (tab labels `1. E15 Reg` /
`2. #526` / `Tank N`), per-tab **Clear** + **Reset all tanks**,
**installable PWA** with used-tank chart cache, draft restore, and offline
save queue, **Stripe Checkout** `$2.99 CAD/month per driver` (early pay via
`/subscribe` during trial; **Plan active** + Billing portal when subscribed),
public `/about` + `/guide` + `/privacy` + `/terms` (shared `SiteFooter`),
safety reminders, and flat history. Operator: **Detours Fleet Operations**
(`OPERATOR_NAME` in `lib/app-copy.ts`). Soft-launch tag: **v0.2.0**. Specs:
`docs/superpowers/specs/2026-07-26-pre-production-readiness-design.md`,
`docs/superpowers/specs/2026-07-28-calculator-form-ux-design.md`,
`docs/superpowers/specs/2026-07-29-offline-pwa-design.md`,
`docs/superpowers/specs/2026-07-30-stripe-billing-design.md`. Original v1
design: `docs/superpowers/specs/2026-07-23-fuel-dip-calculator-design.md`
(**auth diverged three times** — magic-link trial → password auth → phone OTP;
phone OTP is live/primary). Aug 4 audit:
`docs/audit-2026-08-04-phone-otp-stripe.md`.

**Still open / next priorities:**
- **Stripe auto-unlock unproven (user ops):** the event destination
  (`we_1U0k2O13QgrVjwffp66xuTVP` → `/api/stripe/webhook`, events
  `checkout.session.completed` + `customer.subscription.*`) was only created
  Aug 4 after 7 days of zero deliveries — the Aug 4 paid smoke user was
  **manually SQL-backfilled** to `subscription_status = 'active'`. Before
  trusting auto-unlock: Stripe → Webhooks → **Send test event → 200**, or a
  second real Checkout that flips status without SQL. Product
  `prod_UzHfQGqENZ1QUU` / Price `price_1TzJ6e13QgrVjwffdpj7y0nD` (CAD,
  lookup `fuel_dip_monthly`).
- **Disable Supabase email signup server-side (user ops):** Authentication →
  Providers → Email → turn off **Enable email signup**. UI already has no
  create-account path, but the API can still mint email users. Existing email
  accounts stay valid — do NOT disable the Email provider itself.
- Supabase Auth **Site URL** / redirect allow-list should include
  `https://fuel-dip-calculator.app` (+ `/auth/callback`, `/auth/reset-password`)
  for remaining legacy email confirm/reset links.
- Vercel **Preview** env vars (`NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`) still unset — Production only.
- **Project 2 on-device manual checklist** not yet confirmed: install PWA →
  airplane mode → cached-tank calc → queued save → reconnect flush → draft
  restore after swipe-up → expired-trial offline gate.
- **Web push to nudge email→phone migration** — product ask, not built (needs
  design; audience = the 5 email-only users). Wiping/migrating email users
  stays **out of scope** (user decision Aug 4).
- Signature capture (image), history filtering, 12 flagged tanks in
  `review_needed.json`, Sentry, mismatch-audit UI, security headers — deferred.
- Do **not** push full local `supabase/config.toml` via `supabase config push`
  (can clobber dashboard Auth URL / Confirm email settings).

## Security hardenings (Jul 29 2026)

Migration `20260729140000_security_hardenings.sql` applied live (review gate
passed Jul 29 — SQL interpolation verified against regression tanks
#014/#015/#526):
- **H1:** `my_trial_active()` + insert/update RLS on `dip_calculations` (SELECT
  ungated — expired trials keep read access; middleware still gates the UI).
  Null `trial_ends_at` = active, matching middleware. **Stripe (shipped):**
  `my_trial_active()` aliases / uses `my_access_active()` — trial open **or**
  this driver's `subscription_status` in `active`/`trialing`/`past_due`.
  Do not add a second policy check; keep one access definition.
- **H2:** store-both `server_*` columns + `volume_mismatch`; **BEFORE INSERT OR
  UPDATE** trigger (`recompute_dip_volumes()` → `interpolate_dip_volume()`,
  mirrors `interpolate.ts`: exact / linear / out-of-range → null, never
  extrapolates); never blocks saves. Tolerance is **0.5 L** — safe because the
  client does no rounding, so honest divergence is float-vs-numeric noise. A
  null `after_dip_cm` must never flag a mismatch (after-side checks are gated
  on its presence). Mismatch rows are audit-only; no UI on purpose. Spec:
  `docs/superpowers/specs/2026-07-29-security-hardenings-design.md`.
- **H4:** `/auth/callback` `next` allowlisted to `/calculator` | `/history`
  via `lib/auth/safeNextPath.ts` (fixed a real open redirect —
  `next=@evil.com` produced a userinfo-host URL).
- **H3:** leaked-password protection (HaveIBeenPwned) — user confirmed the
  dashboard toggle is **ON** (Aug 4 2026). Closed; all four hardenings done.
- Interplay: an expired-trial row flushed from the offline outbox now gets a
  42501 RLS rejection → classified poison (surfaced as failed, queue not
  wedged) — by design.
- **Driver-only RLS (Jul 31):** migration `20260731161454_driver_only_rls` —
  `drivers` / `dip_calculations` SELECT scoped to `auth.uid()` (no peer
  sharing). Writes already required `driver_id = auth.uid()`.

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
  session + `my_access_active()` (trial **or** paid); redirects to `/login` or
  `/trial-ended`. Allows `/calculator?checkout=success` through so the client
  can poll while the webhook catches up. `/subscribe`, `/about`, `/guide`,
  `/privacy`, `/terms` are public or auth-only as documented below.
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
- `app/trial-ended/page.tsx` — shown when access is inactive (Subscribe CTA;
  redirects away if already subscribed; polls on `?checkout=success`).
- `app/subscribe/page.tsx` — auth-only early subscribe during an active trial
  (same Checkout as trial-ended); middleware skips `my_access_active` for this path.
- `app/about/page.tsx` + `app/guide/page.tsx` — public About + User guide;
  linked from shared `app/components/SiteFooter.tsx` (calculator, history,
  login, trial-ended).
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

## Auth: password → phone OTP (Aug 4 2026)

Phone OTP is now the **primary** sign-in (commit `a26073c`); email/password is
legacy-only for pre-existing accounts.

- Flow: `+1` NANP phone (`lib` NANP helpers) → legal checkbox →
  `request_otp_throttle` RPC → `signInWithOtp` → `verifyOtp` →
  `ensure_trial_driver()` → `my_access_active()` → calculator.
- Migration `20260804120000_phone_otp_throttle.sql`: `otp_throttle` table
  (RLS deny-all) + `request_otp_throttle` RPC (anon + authenticated; **60s /
  5 per hr / 15 per day** per phone) + phone-aware `ensure_trial_driver()`
  (company named from email local-part, or `driver-XXXX` from phone).
- Unique phone enforced by `auth.users` index `users_phone_key`.
- Twilio: subaccount **Fuel Dip Calculator** under the Detours parent, local CA
  sender `+12494022522`, Messaging Service `MGad57b6b121fd6d7dedea793d6a61f147`,
  geo CA+US, Programmable Messaging (**not** Twilio Verify). SIDs live only in
  Supabase Auth SMS config + password manager — never in git/Vercel.
- Supabase Phone provider enabled alongside Email; SMS rate limits left at
  **default** deliberately — do not raise without more product throttle work.
- Sessions: Supabase defaults untouched (refresh tokens rotate, don't expire)
  → ~1 OTP per device sign-in. Do **not** add session time-boxing; it would
  multiply SMS cost.
- **No new email signup** in UI (no `signUp` call); email sign-in +
  forgot-password remain for the legacy email accounts. Wiping/migrating those
  accounts was explicitly ruled out (Aug 4) — don't propose it.

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
  copy: **Detours Fleet Operations**. Contact:
  **`contact@detours-app.com`** (`CONTACT_EMAIL` in `lib/app-copy.ts`).
- **Safety reminder** (`SAFETY_REMINDER` in `lib/app-copy.ts`) on login +
  calculator: verify physical tank tag matches chart number **and** site-plan
  tank charts before delivery.
- **Trial:** migration `20260726175154_seven_day_trial.sql` — 7-day default +
  `ensure_trial_driver()` insert; existing companies unchanged. Trial-ended
  page mentions **$2.99 CAD/month** (`MONTHLY_PRICE_LABEL` in
  `lib/app-copy.ts`; Stripe Checkout is live — see Stripe billing section).
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
  → else `Tank N`. Uses `tankTabLabel()` in `lib/product-grades.ts` — product /
  chart labels are prefixed with slot number (`1. E15 Reg`, `2. #526`). Slots
  report chart via `onSelectedChartChange` and product via
  `onSelectedProductChange`.
- `app/calculator/TankSlot.tsx` — per-tank form (tank picker, safe-fill %,
  product dropdown, before/after dips + results, location under after-delivery,
  retain/signature, save). Calculation logic
  (`calculateBeforeDelivery`/`calculateAfterDelivery`) was **not** changed.
  Still inserts one independent row per tank into `dip_calculations`.
- **Clear button** next to Save resets only that slot (`resetSlot()` via
  `TankSlotHandle`) — doesn't touch the other 3 tabs. Calculator also has
  per-tab **Clear** under the tab bar and **Reset all tanks**.
- **Clear/Reset must not resurrect the tank from boot-time draft seed** —
  `draftTankIdentity()` + `tankCleared` in `TankSlot` (after Clear, IDB draft
  keeps `tankTypeId`/`chartNumber` null).
- **Save no longer redirects to `/history`.** On success, `resetSlot()` + 2.5s
  "Saved ✓" flash so the driver can continue other tanks.

## Stripe billing (Jul 31 – Aug 1 2026)

Direct-to-driver B2C — **not** company/fleet billing. Spec:
`docs/superpowers/specs/2026-07-30-stripe-billing-design.md`.

- Columns on **`drivers`**: `stripe_customer_id`, `subscription_status`, etc.
- `POST /api/stripe/checkout` — Checkout `mode: subscription`; blocks already
  subscribed (409); allowlisted `cancelPath` `/subscribe` | `/trial-ended`.
- `POST /api/stripe/portal` — this driver's Customer Portal.
- `POST /api/stripe/webhook` — signature required; 500 if no driver row matched
  (Stripe retries).
- Access: `my_access_active()` + client `isAccessActive()` /
  `isActiveSubscriptionStatus()`.
- **Early subscribe:** calculator **Subscribe** when online and not paid;
  **Billing** only when `shouldShowBillingLink` (customer **and** non-null
  `subscription_status` — abandoned Checkout creates a customer with null
  status and must not show Billing).
- **Subscribed UI (Aug 4, `e1814bf`):** **Plan active** + Billing for
  subscribed drivers; billing state refreshes on window focus/online; Billing
  link also shows when status is active even if the client customer flag lags.
- **Webhook ops (Aug 4):** Stripe event destination
  `we_1U0k2O13QgrVjwffp66xuTVP` → `https://fuel-dip-calculator.app/api/stripe/webhook`
  created Aug 4 (none existed before — root cause of "paid but locked");
  `STRIPE_WEBHOOK_SECRET` set in Vercel. Auto-unlock **not yet proven
  end-to-end** — see Still open.
- **Post-pay hang fix:** blocked IDB paint then `refreshOnline` unlock must
  hydrate drafts (`needsDraftHydrationAfterUnlock`); checkout return polls
  ~10s (`waitForActiveSubscription`) before showing Subscribe again.
- Logout clears offline session/drafts/outbox (`clearOfflineUserData`) with
  confirm if pending saves exist.

## Calculator form UX (Jul 28 2026)

Spec: `docs/superpowers/specs/2026-07-28-calculator-form-ux-design.md`
(commit `4ff9e49`).

- **Product grade** dropdown from `PRODUCT_GRADES` in `lib/product-grades.ts`:
  E15 Reg, E10 Reg, P93, P91, PE10, U94, LSD Clear, LSD Dyed (optional
  “Select product…”). Still stored as `product_grade` text.
- **Compartment #** removed from UI; saves `compartment_no: null` (column kept).
- **Location label** moved to the bottom of the After delivery section.

## Offline PWA / Project 2 (Jul 29 2026)

Serwist service worker caches the app shell only (never Supabase API).
IndexedDB (`lib/offline/`) holds used-tank charts (meta + points), session
meta (`driverId` / `companyId` / `trialEndsAt`), 4-slot drafts, and a save
  outbox. Offline boot uses local `getSession` + IDB (A1); expired trials are
  gated client-side (A2); chart loads keep the stale-response guard (A3);
  outbox flush poisons non-network failures (A4) and refreshes session once on
  401 (A5). Calculator **paints from IDB first** on reopen (session + tank
  catalog + drafts), then refreshes online in the background. History remains
  online-only. Spec:
  `docs/superpowers/specs/2026-07-29-offline-pwa-design.md`. Local PWA test:
  `npm run build && npm start` (or `npm run dev:pwa`).

Review-hardened in `6e7f643` — three constraints from that fix round are
load-bearing:

- **`draftsReadyRef` gates draft persistence** in `CalculatorClient.tsx` —
  nothing may write the IDB draft until boot has hydrated `slotDraftsRef` from
  `getDraft()`. Online boot regularly takes >400ms (4 network calls), so an
  early debounced persist clobbers real drafts with blanks. Don't remove the
  gate or persist from anywhere that can run pre-hydration.
- **Never precache auth-gated routes** (`next.config.ts`): a SW installing on
  `/login` before sign-in follows the middleware redirect and stores login
  HTML under the precached key until the next deploy. Only `/~offline` is
  precached; the calculator shell relies on runtime document caching after the
  required online sign-in.
- **Outbox error classification is message/code-based**
  (`lib/offline/flushOutbox.ts`): `PostgrestError` exposes `code`, not an HTTP
  `status` — don't reintroduce status-based branches. `PGRST301`/JWT →
  refresh-once-and-retry; `42501`/`23514`/`23505`/"violates…" → poison
  (mark failed, surface, don't block the queue); unknown errors default to
  poison so the queue can never wedge.

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
- **PWA caches app shell + used tanks only.** Do not add Supabase REST caching
  in the service worker. Offline requires a prior online sign-in; uncached tanks
  must show a clear “open once online” error rather than guessing volumes.
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
