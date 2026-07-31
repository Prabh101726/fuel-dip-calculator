# Next Task for Cursor — Stripe Billing after Trial (direct to drivers)

Design/plan revised Jul 31 2026: **sell to drivers**, not companies/fleets.

Repo: `~/dev/fuel-dip-calculator`, `main`. Soft-launch tag **v0.2.0**.
Offline PWA + security hardenings already shipped.

## Spec + plan

- Design: [`docs/superpowers/specs/2026-07-30-stripe-billing-design.md`](superpowers/specs/2026-07-30-stripe-billing-design.md)
- Plan: [`docs/superpowers/plans/2026-07-30-stripe-billing.md`](superpowers/plans/2026-07-30-stripe-billing.md)

## Locked decisions

| Topic | Choice |
| --- | --- |
| Customer | **Driver** (B2C). No company/fleet buyer role in the product |
| Price | `$2.99 CAD/month per driver` — lookup key `fuel_dip_monthly` |
| Stripe rows | Columns on **`drivers`** (not `companies`) |
| `companies` | Internal RLS shell only — keep in DB, ignore in product/billing UX |
| Checkout | Stripe-hosted Checkout `mode: 'subscription'`, `metadata.driver_id` |
| Trial | Keep Postgres 7-day on shell company; **no** Stripe trial |
| Portal | This driver’s Customer Portal |
| Access | `my_access_active()` = trial open OR **this driver’s** status in `active`/`trialing`/`past_due` |
| RLS | **Driver-only** — `drivers` / `dip_calculations` SELECT by `auth.uid()` (migration `20260731161454_driver_only_rls`, live) |
| Tax / fleet seats | Deferred |

## Do not

- Build company admin, invites, or “pay for your fleet”
- Reintroduce company-scoped SELECT that lets drivers share history
- Put Stripe customer ids on `companies`
- Change `lib/dip-calculator/` math
- Put secrets in `NEXT_PUBLIC_*`
- Set `payment_method_types` on Checkout
- `supabase config push`
- Cache Stripe API in the service worker

## Ops prerequisites (user) — remaining

Product/Price already live:
- Product `prod_UzHfQGqENZ1QUU`
- Price `price_1TzJ6e13QgrVjwffdpj7y0nD` (CAD $2.99/mo, lookup `fuel_dip_monthly`)

1. Vercel Production env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
   `STRIPE_PRICE_ID=price_1TzJ6e13QgrVjwffdpj7y0nD`, `SUPABASE_SERVICE_ROLE_KEY`
   (and local `.env.local` for the two Stripe secrets)
2. Stripe webhook → `https://fuel-dip-calculator.vercel.app/api/stripe/webhook`
   (events: `checkout.session.completed`, `customer.subscription.*`)
3. Enable Customer Portal (cancel + update payment method)
4. Redeploy after env vars

## Out of scope (still deferred)

Mismatch-audit UI, signature image capture, history filters, Stripe Tax,
company/fleet multi-driver product.
