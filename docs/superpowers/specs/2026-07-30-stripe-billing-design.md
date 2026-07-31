# Stripe Billing after Trial — Design

**Date:** 2026-07-30 (revised 2026-07-31)  
**Status:** Draft (ready for review)  
**Stripe account:** Detours (`acct_1TOjt513QgrVjwff`) — separate Product/Price for Fuel Dip  
**Planner guide:** `iguide_61V8L923uNlud408W4113QgrVjwff` (accepted)

## Goal

Sell **directly to drivers**: after the 7-day trial, a driver pays **$2.99 CAD/month**
for their own access, unlocks calculator + history (and `dip_calculations` writes),
and manages cancel / card via Stripe Customer Portal. Replace “coming soon” on
`/trial-ended`.

## Product positioning (locked)

| Topic | Choice |
| --- | --- |
| Customer | The **driver** (auth user) — B2C, not fleet sales |
| Company role | **None in the product.** `companies` stays only as internal DB scaffolding for RLS / `company_id` on rows. No company admin, no fleet billing, no “buy for your team” |
| Who pays | The signed-in driver — one Stripe Customer + one subscription per driver |
| Price | **$2.99 CAD / month per driver** (`MONTHLY_PRICE_CAD`) — lookup key `fuel_dip_monthly` |
| Checkout UI | Stripe-hosted Checkout (`mode: 'subscription'`) |
| Trial | Existing **Postgres 7-day** clock (today on `companies.trial_ends_at` because signup auto-creates a 1:1 shell company). Do **not** use Stripe `trial_period_days` |
| Portal | Stripe Customer Portal for that driver’s subscription |
| Entitlement | Webhooks → columns on **`drivers`** |
| Access gate | Trial still open **OR** this driver’s `subscription_status` active |
| Data isolation | **Driver-only RLS** — no peer sharing of `drivers` or `dip_calculations` |
| Tax | Deferred for MVP |
| Payment methods | Omit `payment_method_types` — Dashboard dynamic methods |

### Driver-only RLS (locked)

Migration `20260731161454_driver_only_rls.sql` (live):

- `drivers` SELECT: `id = auth.uid()` (was company-scoped)
- `dip_calculations` SELECT: `driver_id = auth.uid()` (was company-scoped)
- Insert/update still require `driver_id = auth.uid()` + trial/access gate

Drivers never read each other’s profile or history, even if they somehow shared a
shell `company_id`.

## Out of scope

- Fleet / company-paid seats, invites, multi-driver onboarding UX
- Annual plans, coupons, promo codes
- Stripe Tax / tax registrations
- Invoicing-only / B2B quotes
- Changing dip math, offline chart cache, or Serwist shell
- Moving trial clock into Stripe
- Removing or renaming the internal `companies` table (schema keep; product ignore)

## Architecture

```
Driver on /trial-ended  → POST /api/stripe/checkout
                            ↑ session = auth.uid() = drivers.id
                            metadata.driver_id
Stripe webhook → upsert drivers.stripe_* / subscription_status
                            ↓
middleware + my_access_active() + RLS + offline session meta
/calculator → POST /api/stripe/portal (this driver’s customer id)
```

### Data model (`drivers` — billing lives here)

Add columns (nullable until first Checkout):

| Column | Type | Notes |
| --- | --- | --- |
| `stripe_customer_id` | text unique | `cus_…` for this driver |
| `stripe_subscription_id` | text unique | `sub_…` |
| `subscription_status` | text | Stripe status; null = never subscribed |
| `subscription_price_id` | text | optional audit |
| `subscription_current_period_end` | timestamptz | optional UX |

**Do not** put Stripe customer/subscription columns on `companies` for this MVP.

Internal note: `companies` + `company_id` remain for RLS scoping of saved calcs.
Product copy never markets “company” or “per account.”

### Access rule

```
access = (company.trial_ends_at is null OR company.trial_ends_at > now())
      OR driver.subscription_status IN ('active', 'trialing', 'past_due')
```

- Prefer RPC **`my_access_active()`**; keep `my_trial_active()` as a thin alias for RLS.
- Middleware switches from trial-only to `my_access_active()` so a paying driver
  is not bounced to `/trial-ended`.
- Fail **closed** on RPC error for gated routes.
- Offline IDB session meta: cache `subscriptionStatus` for this driver + trial end;
  offline gate uses the same predicate.

### Checkout

Server route (authenticated):

1. `driver_id = auth.uid()` (must exist in `drivers`).
2. Create/reuse Stripe Customer with `metadata.driver_id`, email from auth user.
3. Persist `drivers.stripe_customer_id` if new.
4. `checkout.sessions.create`:
   - `mode: 'subscription'`
   - `line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }]`
   - `customer: cus_…`
   - `client_reference_id` / `metadata.driver_id` = driver UUID
   - `success_url`: `{origin}/calculator?checkout=success`
   - `cancel_url`: `{origin}/trial-ended?checkout=cancel`
   - **Do not** set `payment_method_types`
5. Return `{ url }` → client redirects.

### Webhook

`POST /api/stripe/webhook` (raw body, signature verify with `STRIPE_WEBHOOK_SECRET`).

| Event | Action |
| --- | --- |
| `checkout.session.completed` | Link `customer` + `subscription` to `driver_id` from metadata |
| `customer.subscription.created` / `updated` | Set that driver’s status, ids, period end |
| `customer.subscription.deleted` | Set status `canceled` |
| `invoice.payment_failed` | Rely on subscription status (`past_due`) |

Service-role Supabase updates. Idempotent by `stripe_customer_id` or
`metadata.driver_id`.

### Portal

Authenticated: portal session for **this driver’s** `stripe_customer_id`,
`return_url` → `/calculator`. “Manage billing” only when that driver has a
customer id.

### UI / copy

- `/trial-ended`: **Subscribe — $2.99 CAD/month** (driver language; no company).
- Terms: paid access **per driver**, not “per account.”
- No fleet / admin billing screens.

### Env / secrets

| Var | Where |
| --- | --- |
| `STRIPE_SECRET_KEY` | Vercel (server only) |
| `STRIPE_WEBHOOK_SECRET` | Vercel |
| `STRIPE_PRICE_ID` | Vercel |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel (webhook) — never `NEXT_PUBLIC_` |

### Security

- Entitlement only from webhook → `drivers` columns.
- Checkout/portal: `driver_id` from session, never from client body.
- Webhook signature required.

### Testing

- Unit: access helper (trial × this driver’s status).
- Unit: webhook → **driver** patch mapping.
- Manual: expired trial → driver Checkout → access; cancel → locked; offline
  meta respects driver subscription.

## Success criteria

1. Expired-trial **driver** can pay and use the calculator in one Checkout.
2. RLS insert works after subscribe without extending `trial_ends_at`.
3. That driver’s cancel → UI + RLS lock; history SELECT still readable.
4. No Stripe secrets in client bundle.
5. No product UI that implies a company is the buyer.
