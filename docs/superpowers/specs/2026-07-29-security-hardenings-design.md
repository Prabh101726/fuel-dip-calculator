# Security Hardenings (Jul 26 audit) — Design

**Date:** 2026-07-29  
**Status:** Implemented (H1/H2/H4 live; H3 dashboard ops pending user)  
**Brief:** [`docs/next-task-cursor.md`](../../next-task-cursor.md)

## Goal

Close four Jul 26 audit items without changing dip math or the offline PWA.

## Decisions

- **H1:** Enforce trial on `dip_calculations` INSERT/UPDATE via `my_trial_active()`;
  SELECT stays readable for expired trials.
- **H2:** Store-both — client columns unchanged; add `server_*` + `volume_mismatch`;
  trigger never blocks the save. `BEFORE INSERT OR UPDATE`. Null `after_dip_cm`
  does not imply mismatch.
- **H3:** HaveIBeenPwned leaked-password protection — dashboard only.
- **H4:** `/auth/callback` `next` allowlist `/calculator` | `/history`.

## Forward compatibility

`my_trial_active()` later becomes trial active OR `subscription_active` when
Stripe ships.
