# Stripe Billing after Trial — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sell directly to drivers — after trial, a driver pays $2.99 CAD/month via Stripe Checkout; webhook writes `drivers.subscription_status`; access unlocks for that driver only. No company/fleet billing product.

**Architecture:** Stripe Customer = the driver (`auth.uid()`). Hosted Checkout + Customer Portal. Webhooks update **`drivers`** Stripe columns (service role). `my_access_active()` = company trial still open **OR** this driver’s subscription active. Internal `companies` table stays for RLS only — not the buyer.

**Tech Stack:** Next.js App Router route handlers, `stripe` Node SDK (latest), Supabase service role for webhook updates, existing `@supabase/ssr` session for Checkout/Portal.

**Spec:** [`docs/superpowers/specs/2026-07-30-stripe-billing-design.md`](../specs/2026-07-30-stripe-billing-design.md)

## Global Constraints

- Price: **$2.99 CAD/month per driver**; Product lookup key `fuel_dip_monthly`
- Customer: **driver**, not company / fleet
- Stripe account: Detours `acct_1TOjt513QgrVjwff` — separate Product for Fuel Dip
- Never set `payment_method_types` on Checkout Sessions
- Never put secret/service-role keys in `NEXT_PUBLIC_*`
- Do not change `lib/dip-calculator/` interpolation math
- Do not `supabase config push`
- Fail closed on access RPC errors for `/calculator` and `/history`
- Offline: extend session meta; do not cache Stripe REST in the service worker
- Product copy: driver language only — no “company plan” / “per account”
- RLS: driver-only SELECT on `drivers` / `dip_calculations` (migration
  `20260731161454_driver_only_rls.sql` — **applied live**)

## File map

| Path | Responsibility |
| --- | --- |
| `supabase/migrations/20260731161454_driver_only_rls.sql` | Driver-only SELECT policies (no peer sharing) — **applied live** |
| `supabase/migrations/YYYYMMDDHHMMSS_stripe_billing.sql` | **Driver** Stripe columns + `my_access_active()` + RLS alias |
| `lib/billing/access.ts` | Pure access predicate (trial × driver subscription_status) |
| `lib/billing/access.test.ts` | Matrix unit tests |
| `lib/stripe/server.ts` | Stripe SDK singleton from `STRIPE_SECRET_KEY` |
| `lib/supabase/admin.ts` | Service-role client (server-only) |
| `app/api/stripe/checkout/route.ts` | Create Checkout Session for this driver |
| `app/api/stripe/portal/route.ts` | Portal for this driver’s customer id |
| `app/api/stripe/webhook/route.ts` | Signature verify + **drivers** updates |
| `lib/billing/webhook.ts` | Map Stripe events → driver patch |
| `lib/billing/webhook.test.ts` | Fixture-driven mapping tests |
| `lib/supabase/middleware.ts` | Gate on `my_access_active()` |
| `app/trial-ended/page.tsx` | Subscribe CTA (driver copy) |
| `app/calculator/CalculatorClient.tsx` | Manage billing when **this driver** subscribed |
| `lib/offline/` session meta | Persist this driver’s `subscriptionStatus` |
| `lib/app-copy.ts` / terms | Per-driver price; drop “coming soon” / “per account” |
| `.env.example` | Document Stripe + service role vars |

---

### Task 1: Stripe catalog + env scaffolding

**Files:**
- Create/update: `.env.example`
- Ops: Stripe Dashboard or MCP `stripe_api_write` for Product/Price

- [ ] **Step 1: Create Product + monthly Price**

  Name: `Fuel Dip Calculator`. Recurring monthly **299** cents CAD. Lookup key
  `fuel_dip_monthly`. Record `price_…` id. (One seat = one driver.)

- [ ] **Step 2: Document env vars in `.env.example`**

```bash
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID=
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 3: Add local + Vercel Production values** (user ops)

- [ ] **Step 4: Commit**

```bash
git add .env.example
git commit -m "chore: document Stripe billing env vars"
```

---

### Task 2: Access predicate (TDD)

**Files:**
- Create: `lib/billing/access.ts`
- Test: `lib/billing/access.test.ts`

**Interfaces:**
- Produces: `isAccessActive({ trialEndsAt, subscriptionStatus, now? }): boolean`
- Active statuses: `active` | `trialing` | `past_due`
- `subscriptionStatus` is **this driver’s** status

- [ ] **Step 1: Write failing tests** — expired trial + null status → false; expired + `active` → true; active trial + null → true; null `trialEndsAt` → true; `canceled` → false unless trial still open

- [ ] **Step 2: Implement `isAccessActive`**

- [ ] **Step 3: `npm run test` — pass**

- [ ] **Step 4: Commit**

```bash
git add lib/billing/access.ts lib/billing/access.test.ts
git commit -m "feat: add driver billing access predicate"
```

---

### Task 3: Schema + `my_access_active()`

**Files:**
- Create: `supabase/migrations/<timestamp>_stripe_billing.sql`
- Apply live: `oxxmcdtafnvnkbojnrgx`

**Interfaces:**
- Produces: RPC `my_access_active() returns boolean` for `auth.uid()` driver
- Produces: `my_trial_active()` redefined as `select my_access_active()`

- [ ] **Step 1: Write migration**

```sql
alter table drivers
  add column if not exists stripe_customer_id text unique,
  add column if not exists stripe_subscription_id text unique,
  add column if not exists subscription_status text,
  add column if not exists subscription_price_id text,
  add column if not exists subscription_current_period_end timestamptz;

-- my_access_active():
--   company trial open (via my_company_id / trial_ends_at)
--   OR drivers.subscription_status for auth.uid() in (active, trialing, past_due)
-- my_trial_active(): alias
-- revoke anon; grant authenticated
```

Do **not** add Stripe columns to `companies`.

- [ ] **Step 2: Apply migration**

- [ ] **Step 3: SQL smoke** — past company trial + this driver’s `subscription_status = 'active'` → `my_access_active()` true

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/*_stripe_billing.sql
git commit -m "feat: add driver Stripe columns and my_access_active"
```

---

### Task 4: Stripe + admin clients

**Files:**
- Create: `lib/stripe/server.ts`
- Create: `lib/supabase/admin.ts`
- Modify: `package.json` — add `stripe` dependency

- [ ] **Step 1: `npm install stripe`**

- [ ] **Step 2: `getStripe()` lazy singleton**

- [ ] **Step 3: `createAdminClient()` — server/webhook only**

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json lib/stripe/server.ts lib/supabase/admin.ts
git commit -m "feat: add Stripe SDK and Supabase admin client"
```

---

### Task 5: Webhook mapping (TDD) + route

**Files:**
- Create: `lib/billing/webhook.ts`
- Test: `lib/billing/webhook.test.ts`
- Create: `app/api/stripe/webhook/route.ts`

**Interfaces:**
- Produces: `driverPatchFromStripeEvent(event): { driverId?, stripeCustomerId?, patch } | null`
- Route updates **`drivers`**, not companies

- [ ] **Step 1: Failing tests for checkout.session.completed + subscription updated/deleted** (metadata.driver_id)

- [ ] **Step 2: Implement mapper**

- [ ] **Step 3: Webhook route** — raw body + `constructEvent`; admin update `drivers`

- [ ] **Step 4: `stripe listen --forward-to localhost:3000/api/stripe/webhook`**

- [ ] **Step 5: Commit**

```bash
git add lib/billing/webhook.ts lib/billing/webhook.test.ts app/api/stripe/webhook/route.ts
git commit -m "feat: handle Stripe webhooks for driver subscriptions"
```

---

### Task 6: Checkout + Portal API routes

**Files:**
- Create: `app/api/stripe/checkout/route.ts`
- Create: `app/api/stripe/portal/route.ts`

**Interfaces:**
- Consumes: session user as `driver_id`, `STRIPE_PRICE_ID`
- Metadata: `driver_id` only (not company_id as buyer)
- Produces: `{ url: string }`

- [ ] **Step 1: Checkout POST** — create/reuse Customer for driver; `metadata.driver_id`; return URL

- [ ] **Step 2: Portal POST** — this driver’s `stripe_customer_id`

- [ ] **Step 3: Middleware** — webhook public; checkout/portal use session cookies

- [ ] **Step 4: Manual smoke with test card `4242…`**

- [ ] **Step 5: Commit**

```bash
git add app/api/stripe/checkout/route.ts app/api/stripe/portal/route.ts lib/supabase/middleware.ts
git commit -m "feat: add driver Stripe Checkout and Portal routes"
```

---

### Task 7: Gate middleware + offline session meta

**Files:**
- Modify: `lib/supabase/middleware.ts`
- Modify: `lib/offline/` session meta + offline gate

- [ ] **Step 1: Gate on `my_access_active()`** for `/calculator`, `/history`, `/`

- [ ] **Step 2: RPC error → `/trial-ended` (fail closed)**

- [ ] **Step 3: Persist this driver’s `subscriptionStatus` in IDB**

- [ ] **Step 4: Offline gate uses `isAccessActive`**

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/middleware.ts lib/offline/
git commit -m "feat: gate access on trial or driver subscription"
```

---

### Task 8: Trial-ended + manage-billing UI + copy

**Files:**
- Modify: `app/trial-ended/page.tsx`
- Modify: `app/calculator/CalculatorClient.tsx`
- Modify: `app/terms/page.tsx` / `lib/app-copy.ts` / tests

- [ ] **Step 1: Subscribe CTA** → checkout (driver wording)

- [ ] **Step 2: Manage billing** when **this driver** has `stripe_customer_id`

- [ ] **Step 3: Copy** — `$2.99 CAD/month per driver`; remove “coming soon” / “per account”

- [ ] **Step 4: `npm run lint && npm run typecheck && npm run test && npm run build`**

- [ ] **Step 5: Commit**

```bash
git add app/trial-ended/page.tsx app/calculator/CalculatorClient.tsx app/terms/page.tsx lib/app-copy.ts lib/app-copy.test.ts
git commit -m "feat: wire driver Subscribe and Manage billing UI"
```

---

### Task 9: Production webhook + docs

**Files:**
- Modify: `CLAUDE.md`, `README.md`, `docs/next-task-cursor.md`

- [ ] **Step 1: Live webhook** → `https://fuel-dip-calculator.vercel.app/api/stripe/webhook`

- [ ] **Step 2: Vercel env + redeploy**

- [ ] **Step 3: E2E test-mode then live checklist**

- [ ] **Step 4: Docs — direct-to-driver Stripe shipped**

- [ ] **Step 5: Commit docs**

```bash
git add CLAUDE.md README.md docs/next-task-cursor.md docs/superpowers/specs/2026-07-30-stripe-billing-design.md docs/superpowers/plans/2026-07-30-stripe-billing.md
git commit -m "docs: Stripe direct-to-driver billing status"
```

---

## Manual test plan

1. Set shell company `trial_ends_at` in the past → driver hits `/trial-ended`
2. That driver subscribes → webhook sets **their** `drivers.subscription_status=active` → calculator works
3. Portal cancel → that driver locked; history still readable
4. Offline: subscribed driver meta cached → airplane mode OK; after cancel + online refresh → locked
5. No `sk_` / service role in client bundle

## Rollback

- Remove Subscribe CTA; leave `drivers` columns in place
- Or null out `subscription_status` and disable webhook
