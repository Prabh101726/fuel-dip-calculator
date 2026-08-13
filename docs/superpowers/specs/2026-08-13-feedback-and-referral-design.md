# Feedback Form + Referral Share — Design Spec

**Date:** 2026-08-13  
**Status:** Approved for implementation planning  
**Product:** Fuel Dip Calculator (Detours Fleet Operations)

## Goal

Drivers can send private in-app feedback, and can share a personal app link.
When a **new** driver signs up from that link and **pays**, the **sharer** gets
**14 extra days** of access (trial clock or Stripe renewal — not both for the
same event).

## Locked decisions

| Topic | Choice |
| --- | --- |
| Feedback | Private **form** (not a public forum) |
| Who gets 14 days | **Sharer only** |
| When credit fires | Friend **pays** (active subscription) |
| Paid sharer credit | Push Stripe **renewal +14 days** |
| Trial sharer credit | `companies.trial_ends_at` **+14 days** |
| Friend trial | Unchanged **7 days** |
| Share UX | Header **Share** button (native share + copy link) |
| Email per feedback | Out of scope v1 (read `feedback` in Supabase) |

## Out of scope

- Public forum, comments, leaderboard, cash
- Extra trial days for the friend
- Email/SMS notify operator on each feedback
- Offline outbox for feedback
- Referral caps / fraud scoring beyond self-referral + pay-to-credit
- Changing dip math, PWA cache rules, or phone OTP

## Feedback

- Routes: `/feedback` (auth required; **skip** `my_access_active` so expired
  drivers can still write). Links: calculator header + `SiteFooter`.
- UI: one required textarea (max 2000 chars). Submit → “Thanks — we got it.”
- Offline: disable submit, copy “Needs network.”
- Storage: table `feedback` (`id`, `driver_id`, `body`, `created_at`).
- Writes via RPC `submit_feedback(p_body text)`:
  - authenticated only
  - trim; reject empty / >2000
  - **5 per hour** per `auth.uid()`
- RLS: insert/select own rows only (service role for operator dashboard).
- Do **not** put feedback through the dip-calc offline outbox.

## Referral

### Share link

- Each driver has unique `referral_code` (format `FD` + 4 chars from
  `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, generated in `ensure_trial_driver`).
- URL: `{origin}/login?ref={code}` (`NEXT_PUBLIC_SITE_URL` in production).
- Calculator **Share** button:
  1. `navigator.share` when available (title “Fuel Dip Calculator”, url = link)
  2. else copy link + flash “Link copied”
- Share text may mention: friend gets the normal 7-day trial; you get 14 extra
  days if they subscribe.

### Attribution

- `/login?ref=` stored in `sessionStorage` key `fuel-dip-ref` until claimed.
- After OTP + `ensure_trial_driver()`, call `claim_referral(p_code text)`:
  - no-op if caller already has `referred_by`
  - no-op / error if code missing, unknown, or code belongs to caller
  - else set `referred_by` to that driver’s id **once**
- Do not overwrite `referred_by`.

### Reward (once per paying friend)

After the **referred** driver’s subscription becomes `active` (webhook
`checkout.session.completed` paid, or `customer.subscription.created|updated`
status `active`, or `/api/stripe/sync` seeing active):

1. If `referred_by` is null → stop.
2. If `referral_rewarded_at` is set → stop (idempotent).
3. Load referrer.
4. If referrer has Stripe `subscription_status` in `active`/`trialing`/`past_due`
   and a `stripe_subscription_id` → Stripe
   `subscriptions.update` with `proration_behavior: 'none'` and `trial_end`
   = existing period end + **14 days** (never shorten).
5. Else add **14 days** to referrer’s `companies.trial_ends_at`.
6. Set referred `referral_rewarded_at = now()`; add 14 to referrer
   `referral_days_granted`.
7. Calculator may show a one-line “You earned 14 extra days” when
   `referral_days_granted` increases (session flag is enough; no new inbox).

Self-referral never rewards. Same friend never rewards twice.

## Data model

**`drivers`**

| Column | Type | Notes |
| --- | --- | --- |
| `referral_code` | text unique not null | Backfill existing rows |
| `referred_by` | uuid null references `drivers(id)` | Set once |
| `referral_rewarded_at` | timestamptz null | On **referred** row |
| `referral_days_granted` | int not null default 0 | On **referrer** |

**`feedback`**

| Column | Type |
| --- | --- |
| `id` | uuid pk default `gen_random_uuid()` |
| `driver_id` | uuid not null references `drivers(id)` |
| `body` | text not null |
| `created_at` | timestamptz not null default now() |

## Access / security

- Do not change `my_access_active()` definition except that longer
  `trial_ends_at` naturally extends access.
- Stripe extend uses existing `STRIPE_SECRET_KEY` on the webhook/sync server.
- `claim_referral` / `submit_feedback` are SECURITY DEFINER, `authenticated`
  only (revoke anon).
- Referral codes are not secrets; they only attribute signup.

## Tests

- Code parse / generate uniqueness shape
- claim: self, unknown, first-wins
- reward: skip unpaid; skip already rewarded; trial +14; paid uses period+14
- feedback throttle and empty body
- Do not hit live Stripe in unit tests (inject / stub period-end math)

## Copy

- Guide: Share your link; you get 14 extra days when they subscribe.
- Terms: one sentence that referral credit is 14 days for the referring driver
  after the referred driver pays, at operator discretion for abuse.
