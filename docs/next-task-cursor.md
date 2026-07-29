# Next Task for Cursor — Security Hardenings (Jul 26 audit)

Green-lit Jul 29 2026 (plan `security_hardenings_db1345c1` + two SQL notes).
Repo: `~/dev/fuel-dip-calculator`, `main`. Soft-launch tag **v0.2.0**.

Do **not** change `lib/dip-calculator/` or the offline PWA layer. Do **not**
`supabase config push`.

## Locked decisions

| ID | Choice |
| --- | --- |
| H1 | `my_trial_active()` + recreate insert/update RLS; SELECT ungated |
| H2 | Store-both: keep client volumes; add `server_*` + `volume_mismatch`; never block save |
| H2 trigger | `BEFORE INSERT OR UPDATE` (not INSERT-only) |
| H2 null after | Null `after_dip_cm` is **not** a mismatch by itself |
| H3 | Manual: Supabase Dashboard → Auth → Passwords → leaked-password protection |
| H4 | `next` allowlist: exactly `/calculator` or `/history`, else `/calculator` |

## H1 — Trial in RLS

Migration adds:

```sql
create or replace function my_trial_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select trial_ends_at > now()
     from companies
     where id = my_company_id()),
    true
  );
$$;
```

Recreate `"dip_calculations insert own"` / `"update own"` with
`and my_trial_active()`. Null `trial_ends_at` = active (matches middleware).

Expired-trial outbox flush → PostgREST RLS / `42501` → already poison-classified.

## H2 — Server recompute (store-both)

Columns: `server_safe_fill_liters`, `server_before_volume_liters`,
`server_after_volume_liters` (numeric null); `volume_mismatch boolean not null
default false`; partial index where `volume_mismatch`.

`recompute_dip_volumes()` BEFORE INSERT OR UPDATE:
- Linear interpolate like `lib/dip-calculator/interpolate.ts` (exact / between /
  OOR → that `server_*` null, no extrapolation).
- `server_safe_fill_liters = capacity_liters * safe_fill_pct`.
- Mismatch if present client value diverges > 0.5 L, or present dip is OOR;
  include derived #3 / #6 / #7 when those sides are present.
- Never RAISE.

## H3 — User ops checklist

Supabase Dashboard → Authentication → Passwords → enable **Leaked password
protection** (HaveIBeenPwned). Confirm in review; do not push `config.toml`.

## H4 — Callback `next` allowlist

[`app/auth/callback/route.ts`](../app/auth/callback/route.ts): open redirect via
`${origin}${next}` (e.g. `next=@evil.com`). Exact allowlist only.

## Out of scope

Stripe / `subscription_active`, mismatch UI, dip-calculator edits, offline
layer, `supabase config push`.

## Apply migration

File: `supabase/migrations/20260729140000_security_hardenings.sql`.
Must be applied to live project `oxxmcdtafnvnkbojnrgx` (`supabase db push` or
MCP `apply_migration`).

## Verification

- Existing vitest green; H4 unit tests; no `lib/dip-calculator/` changes
- SQL: expired-trial insert → RLS deny; normal save → mismatch false within
  0.5 L of #014/#015/#526 fixtures; tampered insert → mismatch true; OOR dip →
  saved, mismatch, null server volume
- Callback `next=@evil.com` / `https://evil.com` → `/calculator`
- H3 dashboard confirmation (user)
