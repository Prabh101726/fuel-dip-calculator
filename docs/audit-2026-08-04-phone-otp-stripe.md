# Fuel Dip Calculator — Full App Audit (Aug 4 2026)

**Date:** 2026-08-04  
**Scope:** Soft-launch production app + today’s phone OTP / Twilio / Stripe webhook work  
**Live:** https://fuel-dip-calculator.app  
**Repo:** `main` @ `e1814bf` (Plan active UI) · prior today `a26073c` (phone OTP)  
**Tag:** v0.2.0  

---

## Verdict

| Area | Status |
| --- | --- |
| Calculator math / regression tests | **PASS** — 85 unit tests, typecheck, lint green |
| Phone OTP login (Twilio → Supabase) | **PASS** — real CA OTP smoke succeeded |
| New email signup (UI) | **PASS** — removed; phone is primary |
| Existing email login + forgot-password | **PASS** — still available as secondary path |
| 7-day trial on first phone verify | **PASS** — `ensure_trial_driver()` live + phone-aware naming |
| Stripe Checkout (pay) | **PASS** — CA$2.99 charged for phone smoke user |
| Stripe → app unlock (webhook) | **PARTIAL** — webhook endpoint now Active; earlier pay needed **manual DB backfill**; automated unlock for *next* pay needs verified test delivery **200** |
| Subscribed UI (Plan active / Billing) | **PASS** (code + DB) — hard-refresh / focus refresh required after backfill |
| Offline PWA core | **PASS** (shipped Jul 29) — on-device checklist still open |
| Web push / email→phone migrate | **NOT STARTED** — deferred product ask |

**Overall:** Safe to keep soft-launch traffic on phone OTP + trial. Billing unlock path is wired in Stripe; confirm one **Send test event → 200** (or a second real Checkout) before trusting auto-unlock without manual ops.

---

## Today’s commits

| Commit | What |
| --- | --- |
| `a26073c` | Phone OTP login, NANP helpers, `request_otp_throttle`, phone-aware `ensure_trial_driver`, guide/privacy copy, Stripe customer `phone` |
| `e1814bf` | Subscribed UI: **Plan active** + Billing; refresh billing on focus/online; Billing link if status active even when client customer flag lagged |

**Migration (live):** `20260804120000_phone_otp_throttle.sql`  
- Table `otp_throttle` (RLS deny-all)  
- RPC `request_otp_throttle` (anon + authenticated; +1 NANP; 60s / 5/hr / 15/day)  
- `ensure_trial_driver()` names company from email local-part or `driver-XXXX` from phone  

---

## Auth

### Phone OTP (primary)
- Flow: `+1` NANP → legal checkbox → throttle RPC → `signInWithOtp` → `verifyOtp` → `ensure_trial_driver` → `my_access_active` → calculator  
- Twilio: subaccount **Fuel Dip Calculator**, local CA sender `+12494022522`, Messaging Service `MGad57b6b121fd6d7dedea793d6a61f147`, geo CA+US  
- Supabase Phone provider: **Enabled** (alongside Email)  
- Unique phone: `auth.users` index `users_phone_key`  
- Smoke: user confirmed OTP worked (verify felt slightly slow — expected: OTP + 2 RPCs + navigate)

### Email (legacy only)
- UI: no **Create account** / no `signUp`  
- Secondary: “Sign in with email” + forgot-password  
- **Ops harden (recommended):** Supabase → Authentication → Providers → Email → disable **Enable email signup** so API cannot create new email users  

### Trial
- First provision: `companies.trial_ends_at = now() + 7 days`  
- Re-login same auth user: no trial reset  
- Access: `my_access_active()` = trial open **or** `subscription_status` in `active` / `trialing` / `past_due`  

---

## Stripe billing

### Working
- Checkout creates Stripe customer (`phone` and/or Checkout-collected email)  
- Price `price_1TzJ6e13QgrVjwffdpj7y0nD` ($2.99 CAD)  
- Paid smoke: customer `cus_V0l4OFmbDw83RR`, payment succeeded, Stripe Subscription **Active**  
- Driver row backfilled: `subscription_status = 'active'` for phone `14165655673`  
- UI after `e1814bf`: **Plan active** + **Billing**; Subscribe hidden when subscribed  
- Webhook route responds (unsigned POST → `400 Missing signature` — means `STRIPE_WEBHOOK_SECRET` is set, not empty)

### Fixed today (ops)
- **Root cause of “paid but not subscribed in app”:** no Stripe event destination (0 deliveries for 7 days)  
- **Created:** destination **Fuel Dip Calculator** `we_1U0k2O13QgrVjwffp66xuTVP`  
  - URL: `https://fuel-dip-calculator.app/api/stripe/webhook`  
  - Events: `checkout.session.completed`, `customer.subscription.created|updated|deleted`  
- User updating Vercel `STRIPE_WEBHOOK_SECRET` (`whsec_…`) + redeploy (Production deploy Ready ~11:10 ET)

### Still verify (ops)
- [ ] Stripe → Webhooks → **Send test event** → delivery **200**  
- [ ] Optional second real Checkout on a fresh phone → auto `subscription_status` without SQL  
- [ ] Customer Portal open from **Billing** for the active phone user  

---

## Live data snapshot (audit time)

| Metric | Count |
| --- | --- |
| `auth.users` | **7** |
| Phone users | **2** |
| Email users | **5** |
| Drivers with active-class subscription | **1** |
| `otp_throttle` table | present |
| `request_otp_throttle` RPC | present |

---

## CI / quality gates (local, Aug 4)

- `npm test` — **85 passed** (20 files)  
- `npm run typecheck` — **clean**  
- `npm run lint` — **clean**  
- GitHub Actions CI runs on each push to `main`  

---

## Product areas (pre-existing, still sound)

| Feature | Notes |
| --- | --- |
| Dip interpolate + #1–#7 calculate | Unchanged; regression fixtures tanks #014/#015/#526 |
| 4-tab calculator, Clear / Reset all | Load-bearing: tabs stay mounted |
| Offline PWA | App shell + used tanks; no Supabase REST cache in SW |
| RLS / security hardenings | H1 access on writes, H2 mismatch audit columns, H4 callback allowlist; H3 HaveIBeenPwned — user said ON earlier |
| Legal / About / Guide | Detours Fleet Operations; privacy mentions phone/SMS |
| Custom domain | `fuel-dip-calculator.app` on Vercel |

---

## Open / next (prioritized)

1. **Confirm webhook test delivery 200** (closes Stripe auto-unlock risk)  
2. **Disable Supabase email signup** (server-side; UI already blocks)  
3. **Supabase Site URL / redirects** include `.app` for any remaining email confirm/reset links  
4. **PWA on-device checklist** (install → airplane → cache → outbox → draft restore)  
5. **Web push to nudge email → phone** — product request; **not built** (needs design: audience A = email-only users)  
6. Deferred: signature image, history filters, 12 flagged tanks, Sentry, mismatch UI, Preview env vars  

---

## Explicit non-goals today (confirmed)

- Wipe / migrate existing email auth users — **out of scope**  
- Raise Supabase SMS rate limit — keep default until more throttle product work  
- Twilio Verify API — using Programmable Messaging only  

---

## How to re-check quickly

```bash
# Quality
npm test && npm run typecheck && npm run lint

# Webhook secret present (expect 400 missing signature, not 500 secret missing)
curl -s -X POST https://fuel-dip-calculator.app/api/stripe/webhook \
  -H 'Content-Type: application/json' -d '{}'
```

Supabase SQL: count users / check `drivers.subscription_status` for phone accounts.  
Stripe: Webhooks → Fuel Dip Calculator → Event deliveries.

---

## Sign-off

| Check | Result |
| --- | --- |
| Today’s phone OTP ship | **Working in production** |
| Today’s subscribed UI | **Shipped; refresh to see Plan active** |
| Stripe pay | **Working** |
| Stripe webhook auto-unlock | **Configured; confirm one 200 delivery** |
| Full calculator / offline / RLS | **No regressions found in this pass** |

*Auditor: Cursor agent pass, Aug 4 2026. Re-run ops checkboxes above after webhook test event.*
