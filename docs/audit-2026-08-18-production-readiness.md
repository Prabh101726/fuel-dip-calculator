# Fuel Dip Calculator — Production Audit

**Date:** 2026-08-18  
**HEAD:** `main` @ `ee3e7e9`  
**Live:** https://fuel-dip-calculator.app  
**Tag:** v0.2.1  
**Prior:** `docs/audit-2026-08-12-production-readiness.md`

---

## Verdict

**Soft-launch GO.** Core product is intact: calc math, phone OTP, billing unlock, PWA constraints, RLS, catalog, feedback, referral. Live traffic is growing (4 → 6 phone drivers since Aug 14).

**Email provider Disabled Aug 18** (Phone only). Sentry project `detours-mobile/fuel-dip-calculator` and feedback email to `contact@` shipped the same day (needs Production deploy + `RESEND_API_KEY`). Twilio spend cap still open before wide ads.

---

## Scorecard

| Gate | Status |
| --- | --- |
| Auth (phone-only) | **PASS** |
| Billing / Stripe (webhook + sync) | **PASS** |
| Safety-critical calc | **PASS** (112 tests; catalog 293 / 38,366 unchanged) |
| Offline PWA (precache `/~offline` only) | **PASS** |
| RLS / EXECUTE privileges | **PASS** |
| Feedback + referral (Aug 13) | **PASS** |
| Legal / public pages | **PASS** |
| CI | **PASS** |
| Ops remaining | **PARTIAL** (Twilio spend cap; Preview env) |

---

## Live evidence (Aug 18)

| Check | Result |
| --- | --- |
| Unit tests / lint / typecheck | **120/120** at Sentry/notify ship; **112/112** at morning audit |
| GitHub Actions | success on `ee3e7e9` |
| `/login` `/privacy` `/refer` `/guide` | 200 |
| `/feedback` logged-out | 307 → login (auth-only, as designed) |
| Unsigned webhook POST | 400 `Missing signature` (secret present) |
| auth.users | **6** phone, **0** email-only |
| Drivers | 6 (3 `active`, 3 trial open) |
| `referred_by` set | 0 (signups not from Share links yet) |
| Invalid `referral_code` | 0 |
| Tank types / dip points | 293 / 38,366 |
| `dip_calculations` | 0 (nobody has saved a sheet yet) |
| `feedback` | 1 row |
| `ensure_trial_driver` | still `interval '7 days'` |
| `my_company_id` anon EXECUTE | false |
| `recompute_dip_volumes` anon/auth EXECUTE | false / false |
| `claim_referral_reward` / `unclaim` anon/auth | false / false (service_role only) |
| `request_otp_throttle` anon | true (required pre-login) |

Advisor noise that is **by design**, not regressions:

- `otp_throttle` RLS on, zero policies (deny-all; only the throttle RPC writes)
- anon EXECUTE on `request_otp_throttle` (needed before `signInWithOtp`)
- authenticated EXECUTE on `ensure_trial_driver` / `claim_referral` / `submit_feedback` / access helpers (app RPCs)
- HaveIBeenPwned advisor may show off; phone-only UI, no password signup

---

## Intact since Aug 12 / shipped Aug 13

- Phone OTP only; email-only auth users gone
- Stripe webhook signature + `/api/stripe/sync`
- Dip catalog unchanged; interpolation tests green
- Feedback `/feedback` + public `/refer` + calculator Share
- Migration `feedback_and_referral` live
- SiteSync org still **two projects** (Detours + Fuel Dip); do not merge databases

---

## Still open (ops)

1. ~~Disable Supabase Email signup~~ **done** (Email provider Disabled)
2. Twilio spend cap on Fuel Dip subaccount before wide ads
3. Optional: Vercel Preview env vars, security headers, 12 flagged tanks; SiteSync org still **Free**

---

## Soft-launch vs wide

| Question | Answer |
| --- | --- |
| Limited driver traffic? | **Yes** (6 phone, growing) |
| Trust pay → unlock? | **Yes** (3 active) |
| Offline / calc / RLS intact? | **Yes** |
| Wide ads / public push? | **After** Twilio spend cap; Sentry + `contact@` notify code ready |
