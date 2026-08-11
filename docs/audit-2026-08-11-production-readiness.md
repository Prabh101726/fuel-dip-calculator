# Fuel Dip Calculator — Full Production Readiness Audit

**Date:** 2026-08-11  
**Auditor:** Senior code + live ops pass (Cursor)  
**Live:** https://fuel-dip-calculator.app  
**Repo:** `main` @ `0d4889a`  
**Tag:** v0.2.0 (soft launch)

---

## Verdict

**Soft-launch READY.** No open safety-critical code blocker. Calculator math, auth, RLS write gates, and Stripe unlock (webhook **200** + sync fallback) are production-shaped and verified today.

Remaining work is **ops hardening** and documented soft-launch deferrals.

| Gate | Status |
| --- | --- |
| Safety-critical calc | **PASS** |
| Auth & access | **PASS** |
| RLS / volume integrity | **PASS** |
| Stripe billing | **PASS** (webhook 200 proven Aug 11) |
| API surface | **PASS** |
| Legal / public | **PASS** |
| CI (lint / typecheck / 90 tests) | **PASS** |
| Offline PWA | **PARTIAL** (code OK; device checklist open) |
| Ops hardenings | **PARTIAL** |
| Observability | **PARTIAL** (no Sentry) |

---

## Live snapshot (Aug 11)

| Metric | Value |
| --- | --- |
| `auth.users` | 8 |
| Phone users | 3 |
| Email-only users | 5 |
| Drivers | 7 |
| Subscribed (`active`/`trialing`/`past_due`) | **2** |
| Stripe customers on drivers | 4 |
| `tank_types` / `dip_chart_points` | 293 / 38,366 |
| `dip_calculations` | 0 |
| `volume_mismatch` | 0 |

Production probes: `/login` 200, `/privacy` 200, unsigned webhook → `400 Missing signature` (secret present).

---

## Area notes

### 1. Safety-critical calc — PASS
- `interpolateVolume` never extrapolates (`DipOutOfRangeError`).
- Before/after delivery chain mirrors paper #1–#7.
- Regression fixtures: tanks #015, #014, #526.
- Tank picker stale-response guard (`isStaleTankPointsResponse`) — Jul 26 race **fixed**.

### 2. Auth & access — PASS
- Phone OTP primary (`signInWithOtp` / `verifyOtp` + `request_otp_throttle`).
- Legacy email sign-in + forgot-password only (no UI signup).
- Middleware: session + `my_access_active()` on `/calculator` `/history`.
- `/auth/callback` `next` allowlisted; reset-password does **not** go through trial gate.
- `ensure_trial_driver()` — 7-day trial, phone-aware naming.

### 3. RLS / integrity — PASS
- INSERT/UPDATE on `dip_calculations` require `my_trial_active()` → aliased to `my_access_active()` (trial **or** paid statuses).
- SELECT remains driver-scoped, ungated after expiry (by design).
- BEFORE INSERT/UPDATE trigger recomputes `server_*` volumes; `volume_mismatch` audit-only (0.5 L).

### 4. Stripe — PASS (as of Aug 11)
- Checkout / portal / webhook / **`/api/stripe/sync`** live.
- Webhook endpoint `we_1U0k2O…` → `https://fuel-dip-calculator.app/api/stripe/webhook`.
- Earlier 400s were **Invalid signature**; signing secret corrected; manual resend → **200** `{received:true}`.
- Sync path covers future webhook lag without SQL backfill.

### 5. Offline PWA — PARTIAL
- Serwist: `/~offline` only precached; no Supabase REST caching.
- `draftsReadyRef` gates draft persistence; outbox poison/auth classification sound.
- **Still open:** on-device checklist (install → airplane → queued save → flush → draft restore → expired-trial offline gate).

### 6. CI — PASS
- `.github/workflows/ci.yml`: lint, typecheck, test, build.
- Local Aug 11: **90/90** tests, typecheck clean, eslint clean.

---

## Ranked open risks

| Sev | Item | Action |
| --- | --- | --- |
| High | Email signup still API-enabled | Supabase → Email → disable **Enable email signup** |
| High | Accidental `supabase config push` | Never push full local `config.toml` |
| Med | `/calculator?checkout=success` UI bypass | Strip query after poll; or time-box bypass |
| Med | PWA device checklist unsigned | Run once on iPad/phone |
| Med | Anon EXECUTE on `my_company_id`, `recompute_dip_volumes` | Revoke anon ([advisor](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)) |
| Med | Leaked-password protection off | Dashboard toggle ([docs](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)) |
| Med | Preview env unset | Set `NEXT_PUBLIC_SUPABASE_*` for Preview |
| Low | 12 tanks in `review_needed.json` | Manual chart review before seed |
| Low | No Sentry / mismatch UI | Deferred |
| Low | `SECURITY.md` still email-primary | Refresh docs |

---

## Supabase advisors (summary)

**Security:** `otp_throttle` RLS with no policies = intentional deny-all. Several SECURITY DEFINER EXECUTE warnings (expected for RPCs; tighten anon). **HIBP disabled** (WARN).

**Performance:** Missing FK indexes on `dip_calculations` / `drivers.company_id` — fine at current scale (0 calc rows).

---

## Closed since Jul 26 audit

- Tank-chart race, open redirect, RLS write gate, server volume recompute  
- Phone OTP + throttle  
- Stripe Checkout + portal + webhook signing (200) + sync fallback  
- Plan active UI confirmed on device after pay  

---

## Soft-launch go / no-go

| Question | Answer |
| --- | --- |
| Safe for limited driver traffic? | **Yes** |
| Trust auto-unlock after pay? | **Yes** (webhook 200 + sync) |
| Ready for wide public marketing? | **Not yet** — disable email signup, run PWA checklist, consider Sentry |
