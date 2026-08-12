# Fuel Dip Calculator — Full Re-Audit

**Date:** 2026-08-12  
**HEAD:** `main` @ `4cef5b3`  
**Live:** https://fuel-dip-calculator.app  
**Tag:** v0.2.0 soft launch  
**Prior:** `docs/audit-2026-08-11-production-readiness.md`

---

## Verdict

**Soft-launch GO.** No safety-critical code blocker. Ready for limited / known drivers.

**Wide marketing HOLD** until Supabase dashboard **Enable email signup** is off (and ideally Sentry before big traffic).

---

## Scorecard

| Gate | Status |
| --- | --- |
| Auth (phone-only) | **PASS** |
| Billing / Stripe (webhook + sync) | **PASS** |
| Safety-critical calc | **PASS** |
| Offline PWA (+ InstallHint) | **PASS** |
| RLS / EXECUTE privileges | **PASS** |
| API surface (4 Stripe routes) | **PASS** |
| CI (94 tests, lint, types, Actions green) | **PASS** |
| Legal / public pages | **PASS** |
| Ops remaining | **PARTIAL** (1 dashboard toggle) |
| Deferred features | Documented backlog |

---

## Live evidence (Aug 12)

| Check | Result |
| --- | --- |
| Unit tests | **94/94** |
| Lint / typecheck | clean |
| GitHub Actions | success on `4cef5b3` |
| `/login`, `/privacy` | 200 |
| Unsigned webhook POST | 400 Missing signature (secret present) |
| auth.users | 8 (3 phone, 5 email-only locked out of UI) |
| Subscribed drivers | 2 |
| Tank types | 293 |
| `my_company_id` anon EXECUTE | false |
| `recompute_dip_volumes` anon/auth EXECUTE | false / false |
| `request_otp_throttle` anon | true (required pre-login) |

---

## Closed since Aug 11

- Phone-only auth UI (`36511dc`)
- Webhook signing **200** + `/api/stripe/sync` (`0d4889a`)
- Checkout bypass requires `stripe_customer_id` (`5ec24b6`)
- Privilege revoke migration applied live
- Offline PWA field-confirmed
- Install / Add to Home Screen (`440dcca` / `4cef5b3`)

---

## Still open (ops)

1. **Disable Supabase Email → Enable email signup** (do not `config push`)
2. Optional: Preview env vars, Sentry, security headers, clean up 5 email-only users, review 12 flagged tanks

---

## Soft-launch vs wide

| Question | Answer |
| --- | --- |
| Limited driver traffic? | **Yes** |
| Trust pay → unlock? | **Yes** |
| Offline ready? | **Yes** |
| Wide ads / public push? | **After** email-signup disable (+ Sentry recommended) |
