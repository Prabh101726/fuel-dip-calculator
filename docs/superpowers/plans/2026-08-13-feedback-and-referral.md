# Feedback + Referral Share Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drivers send private in-app feedback and share a personal signup link; when that friend **pays**, the sharer gets **14 extra days** (trial clock or Stripe renewal).

**Architecture:** Unique `referral_code` on `drivers`. Login `?ref=` → `sessionStorage` → `claim_referral` RPC after OTP. Stripe webhook/sync, after writing `active`, runs `applyReferralGrantForDriver`. Feedback is an auth-only `/feedback` page calling `submit_feedback` (5/hour). No new vendors.

**Tech Stack:** Next.js App Router, Supabase RPC + RLS, existing Stripe Node SDK + webhook/sync routes, Vitest.

**Spec:** [`docs/superpowers/specs/2026-08-13-feedback-and-referral-design.md`](../specs/2026-08-13-feedback-and-referral-design.md)

**Locked decisions (do not re-litigate):**

- **A.** Credit fires only when the **referred** driver’s `subscription_status` is `"active"`. Not `trialing`, not `past_due`. Referrer branch still uses `isActiveSubscriptionStatus` (`active` / `trialing` / `past_due`).
- **B.** Feedback link lives in `CalculatorClient` header next to History **only**. Do **not** touch `app/components/SiteFooter.tsx` (it renders on public pages and would bounce logged-out visitors to `/login`). Spec still mentions the footer; this is a plan-level override.

## Global Constraints

- Bonus: **14 days**; friend trial stays **7 days**
- Credit **sharer only**, only after referred driver `subscription_status === "active"`
- Paid sharer: Stripe `trial_end` = period end + 14d, `proration_behavior: 'none'`
- Trial sharer: `companies.trial_ends_at` extended from `max(now, trial_ends_at)` + 14 days. If `trial_ends_at` is **null** (access-forever), treat as failed apply and **unclaim**
- Phone OTP only; do not reintroduce email signup UI
- Do not change `lib/dip-calculator/` math
- Do not `supabase config push`
- Do not put feedback in the dip-calc offline outbox
- Do not cache Stripe/Supabase REST in the service worker
- `/feedback` is **not** precached. `next.config.ts` must keep precaching `/~offline` only (accepted for v1)
- Referral codes are not secrets
- Apply live SQL via Supabase MCP `apply_migration` **and** keep a matching file under `supabase/migrations/`

## File map

| Path | Responsibility |
| --- | --- |
| `lib/referral/code.ts` | Generate / validate `FD` + 4-char codes |
| `lib/referral/code.test.ts` | Code tests |
| `lib/referral/storage.ts` | `sessionStorage` key `fuel-dip-ref` |
| `lib/referral/grant.ts` | Pure: `hasPaidStatus`, `decideReferralGrant`, `nextTrialEndsAt` |
| `lib/referral/grant.test.ts` | Grant decision + trial-clock tests |
| `lib/referral/applyGrant.ts` | Claim-then-apply; unclaim on any failure |
| `lib/referral/applyGrant.test.ts` | Null-trial unclaim; claim-then-apply |
| `lib/feedback/submit.ts` | Client helper for `submit_feedback` RPC |
| `supabase/migrations/YYYYMMDDHHMMSS_feedback_and_referral.sql` | Columns, `feedback`, RPCs, RLS, claim/unclaim |
| `app/api/stripe/webhook/route.ts` | After driver patch, grant if active; rethrow → 500 |
| `app/api/stripe/sync/route.ts` | Same grant after sync; log and continue on grant failure |
| `lib/stripe/extendSubscription.ts` | Stripe `subscriptions.update` trial_end |
| `app/login/LoginForm.tsx` | Persist `?ref=`, `claim_referral` after auth |
| `app/feedback/page.tsx` | Form UI |
| `app/calculator/CalculatorClient.tsx` | Share + Feedback header links |
| `lib/supabase/middleware.ts` | Add `/feedback` to `isAuthOnly` only |
| `app/guide/page.tsx` / `app/terms/page.tsx` | Copy |
| `CLAUDE.md` | Status note |

Do **not** edit `app/components/SiteFooter.tsx`.

---

### Task 1: Referral code helpers

**Files:**
- Create: `lib/referral/code.ts`
- Test: `lib/referral/code.test.ts`

**Interfaces:**
- Produces: `REFERRAL_CODE_PREFIX`, `generateReferralCode()`, `normalizeReferralCode()`, `isValidReferralCode()`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import {
  generateReferralCode,
  isValidReferralCode,
  normalizeReferralCode,
} from "./code";

describe("referral codes", () => {
  it("normalizes and accepts FD + 4 alphabet chars", () => {
    expect(normalizeReferralCode(" fd-7k2p ")).toBe("FD7K2P");
    expect(isValidReferralCode("FD7K2P")).toBe(true);
  });

  it("rejects self-looking junk", () => {
    expect(isValidReferralCode("")).toBe(false);
    expect(isValidReferralCode("HELLO")).toBe(false);
    expect(isValidReferralCode("FD0000")).toBe(false);
  });

  it("generates FD + 4 chars from the alphabet", () => {
    let i = 0;
    const seq = [0, 1, 2, 3];
    const code = generateReferralCode(() => seq[i++] ?? 0);
    expect(code).toMatch(/^FD[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
    expect(isValidReferralCode(code)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/referral/code.test.ts`  
Expected: FAIL cannot find module `./code`

- [ ] **Step 3: Write minimal implementation**

```ts
export const REFERRAL_CODE_PREFIX = "FD";
export const REFERRAL_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeReferralCode(raw: string | null | undefined): string {
  return (raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidReferralCode(raw: string | null | undefined): boolean {
  const code = normalizeReferralCode(raw);
  if (code.length !== 6 || !code.startsWith(REFERRAL_CODE_PREFIX)) return false;
  const rest = code.slice(2);
  return [...rest].every((ch) => REFERRAL_ALPHABET.includes(ch));
}

/** `nextInt` must return >= 0. Used with `Math.random` or a test stub. */
export function generateReferralCode(nextInt: () => number): string {
  let rest = "";
  for (let i = 0; i < 4; i++) {
    const n = Math.abs(Math.floor(nextInt())) % REFERRAL_ALPHABET.length;
    rest += REFERRAL_ALPHABET[n];
  }
  return `${REFERRAL_CODE_PREFIX}${rest}`;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/referral/code.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit** after `npm run lint && npm run typecheck && npm test`

```bash
git add lib/referral/code.ts lib/referral/code.test.ts
git commit -m "feat: add referral code helpers"
```

---

### Task 2: Grant decision helper (pure)

**Files:**
- Create: `lib/referral/grant.ts`
- Test: `lib/referral/grant.test.ts`

**Interfaces:**
- Consumes: `isActiveSubscriptionStatus` from `lib/billing/access.ts`
- Produces: `REFERRAL_BONUS_DAYS`, `hasPaidStatus()`, `decideReferralGrant()`, `addDaysIso()`, `nextTrialEndsAt()`, `stripeTrialEndUnix()`

`hasPaidStatus` is `"active"` only — ACCESS check (`isActiveSubscriptionStatus`) is **not** a payment check, and our own reward flips a subscription to `trialing`.

- [ ] **Step 1: Write the failing test**

Include the original skip/unpaid/already-rewarded/self + trial vs Stripe cases, **plus**:

```ts
it("skips when referred is trialing or past_due", () => {
  expect(
    decideReferralGrant({
      referredStatus: "trialing",
      referred,
      referrer: sharerTrial,
    }),
  ).toBeNull();
  expect(
    decideReferralGrant({
      referredStatus: "past_due",
      referred,
      referrer: sharerTrial,
    }),
  ).toBeNull();
});

it("still extends Stripe when the referrer is trialing or past_due", () => {
  const d = decideReferralGrant({
    referredStatus: "active",
    referred,
    referrer: { ...sharerPaid, subscription_status: "trialing" },
  });
  expect(d?.kind).toBe("stripe");
});

describe("nextTrialEndsAt", () => {
  const now = new Date("2026-08-13T00:00:00.000Z");

  it("returns null when trial_ends_at is null (access-forever)", () => {
    expect(nextTrialEndsAt(null, now)).toBeNull();
  });

  it("extends from now when the trial already expired", () => {
    expect(nextTrialEndsAt("2026-07-01T00:00:00.000Z", now)).toBe(
      "2026-08-27T00:00:00.000Z",
    );
  });

  it("extends from trial_ends_at when it is still in the future", () => {
    expect(nextTrialEndsAt("2026-08-20T00:00:00.000Z", now)).toBe(
      "2026-09-03T00:00:00.000Z",
    );
  });
});
```

- [ ] **Step 2: Run to verify fail** — `npx vitest run lib/referral/grant.test.ts`

- [ ] **Step 3: Implement**

```ts
import { isActiveSubscriptionStatus } from "@/lib/billing/access";

export const REFERRAL_BONUS_DAYS = 14;

export function hasPaidStatus(status: string | null | undefined): boolean {
  return status === "active";
}

export type ReferralDriver = {
  id: string;
  referred_by: string | null;
  referral_rewarded_at: string | null;
};

export type ReferrerDriver = {
  id: string;
  subscription_status: string | null;
  stripe_subscription_id: string | null;
};

export type ReferralGrant =
  | { kind: "trial"; referrerId: string; referredId: string }
  | {
      kind: "stripe";
      referrerId: string;
      referredId: string;
      subscriptionId: string;
    };

export function decideReferralGrant(input: {
  referredStatus: string | null | undefined;
  referred: ReferralDriver;
  referrer: ReferrerDriver | null;
}): ReferralGrant | null {
  if (!hasPaidStatus(input.referredStatus)) return null;
  const { referred, referrer } = input;
  if (!referred.referred_by || referred.referral_rewarded_at) return null;
  if (!referrer || referrer.id !== referred.referred_by) return null;
  if (referrer.id === referred.id) return null;
  if (
    isActiveSubscriptionStatus(referrer.subscription_status) &&
    referrer.stripe_subscription_id
  ) {
    return {
      kind: "stripe",
      referrerId: referrer.id,
      referredId: referred.id,
      subscriptionId: referrer.stripe_subscription_id,
    };
  }
  return { kind: "trial", referrerId: referrer.id, referredId: referred.id };
}

export function addDaysIso(iso: string, days: number): string {
  const ms = new Date(iso).getTime() + days * 86_400_000;
  return new Date(ms).toISOString();
}

/** Null trial_ends_at means access-forever — do not invent a date. */
export function nextTrialEndsAt(
  trialEndsAt: string | null | undefined,
  now: Date,
): string | null {
  if (trialEndsAt == null || trialEndsAt === "") return null;
  const current = new Date(trialEndsAt).getTime();
  if (Number.isNaN(current)) return null;
  const base = Math.max(now.getTime(), current);
  return new Date(base + REFERRAL_BONUS_DAYS * 86_400_000).toISOString();
}

export function stripeTrialEndUnix(
  periodEndIso: string | null,
  nowUnix: number,
): number {
  const bonus = REFERRAL_BONUS_DAYS * 86_400;
  if (!periodEndIso) return nowUnix + bonus;
  const period = Math.floor(new Date(periodEndIso).getTime() / 1000);
  return Math.max(period, nowUnix) + bonus;
}
```

- [ ] **Step 4: Tests pass** — `npx vitest run lib/referral/grant.test.ts`
- [ ] **Step 5: Commit** after lint/typecheck/test — `feat: decide referral grant trial vs Stripe`

---

### Task 3: Migration — columns, feedback, RPCs

**Files:**
- Create via `supabase migration new feedback_and_referral`
- Apply live with MCP `apply_migration` (same SQL)

**Notes:** Backfill `referral_code` for existing phone drivers. `ensure_trial_driver` must set a unique code on insert (retry on unique violation). Keep 7-day trial insert unchanged. **Inline the full function** from `supabase/migrations/20260804120000_phone_otp_throttle.sql` lines 88–137 — do not leave a TBD “read live definition” comment (that is how the 7-day trial gets reverted to 14).

- [ ] **Step 1: Create migration file**

Run: `supabase migration new feedback_and_referral`

- [ ] **Step 2: Write SQL** (full file contents)

Backfill **must** apply `translate(..., '01OI', '2345')` in the **primary** update, not only the collision branch. UUID hex contains `0` and `1`, which `REFERRAL_ALPHABET` excludes; without translate, `isValidReferralCode` rejects every existing driver and attribution silently fails.

```sql
alter table public.drivers
  add column if not exists referral_code text,
  add column if not exists referred_by uuid references public.drivers (id),
  add column if not exists referral_rewarded_at timestamptz,
  add column if not exists referral_days_granted integer not null default 0;

-- Backfill unique codes for existing rows. Translate 0/1/O/I so the
-- result matches REFERRAL_ALPHABET (no hex 0/1).
update public.drivers d
set referral_code = 'FD' || translate(
  upper(substr(replace(d.id::text, '-', ''), 1, 4)),
  '01OI', '2345'
)
where d.referral_code is null;

-- Collision bump
do $$
declare
  r record;
  n int;
  candidate text;
begin
  for r in select id, referral_code from public.drivers loop
    candidate := r.referral_code;
    n := 0;
    while exists (
      select 1 from public.drivers x
      where x.referral_code = candidate and x.id <> r.id
    ) loop
      n := n + 1;
      candidate := 'FD' || translate(
        upper(substr(md5(r.id::text || n::text), 1, 4)),
        '01OI', '2345'
      );
    end loop;
    update public.drivers set referral_code = candidate where id = r.id;
  end loop;
end $$;

do $$
begin
  if exists (
    select 1 from public.drivers
    where referral_code is null
       or referral_code !~ '^FD[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$'
  ) then
    raise exception 'invalid referral_code backfill';
  end if;
end $$;

alter table public.drivers
  alter column referral_code set not null;

create unique index if not exists drivers_referral_code_key
  on public.drivers (referral_code);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

create policy feedback_select_own on public.feedback
  for select to authenticated
  using (driver_id = auth.uid());

create policy feedback_insert_own on public.feedback
  for insert to authenticated
  with check (driver_id = auth.uid());

-- ensure_trial_driver: copy verbatim from 20260804120000 lines 88-137
-- except the drivers insert also sets a unique referral_code with retry.
-- Keep 7-day trial. Keep revoke/grant and comment on function.

create or replace function public.ensure_trial_driver()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  user_email text;
  user_phone text;
  company_name text;
  new_company_id uuid;
  v_code text;
  i int;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if exists (select 1 from drivers where id = uid) then
    return;
  end if;

  select u.email, u.phone into user_email, user_phone
  from auth.users u
  where u.id = uid;

  company_name := coalesce(
    nullif(split_part(coalesce(user_email, ''), '@', 1), ''),
    case
      when user_phone is not null and length(regexp_replace(user_phone, '\D', '', 'g')) >= 4
        then 'driver-' || right(regexp_replace(user_phone, '\D', '', 'g'), 4)
      else null
    end,
    'Trial company'
  );

  insert into companies (name, trial_ends_at)
  values (company_name, now() + interval '7 days')
  returning id into new_company_id;

  for i in 1..32 loop
    v_code := 'FD';
    for j in 1..4 loop
      v_code := v_code || substr(
        'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
        1 + floor(random() * 32)::int,
        1
      );
    end loop;
    begin
      insert into drivers (id, company_id, role, referral_code)
      values (uid, new_company_id, 'driver', v_code);
      exit;
    exception
      when unique_violation then
        if i = 32 then
          raise;
        end if;
    end;
  end loop;
end;
$$;

revoke all on function public.ensure_trial_driver() from public;
revoke all on function public.ensure_trial_driver() from anon;
grant execute on function public.ensure_trial_driver() to authenticated;

comment on function public.ensure_trial_driver() is
  'First login/signup: provision company (7-day trial) + drivers row with unique referral_code. Supports email or phone auth users. No-op if driver exists.';

create or replace function public.claim_referral(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  code text;
  referrer uuid;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  code := upper(regexp_replace(coalesce(p_code, ''), '[^A-Z0-9]', '', 'g'));
  if code is null or length(code) <> 6 or left(code, 2) <> 'FD' then
    return;
  end if;
  if exists (select 1 from drivers where id = uid and referred_by is not null) then
    return;
  end if;
  select id into referrer from drivers where referral_code = code;
  if referrer is null or referrer = uid then
    return;
  end if;
  update drivers set referred_by = referrer where id = uid and referred_by is null;
end;
$$;

revoke all on function public.claim_referral(text) from public;
revoke all on function public.claim_referral(text) from anon;
grant execute on function public.claim_referral(text) to authenticated;

-- Claim first (atomic), increment referral_days_granted in the same function.
-- If apply later fails, unclaim_referral_reward rolls both back.
create or replace function public.claim_referral_reward(p_referred uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer uuid;
begin
  update public.drivers
  set referral_rewarded_at = now()
  where id = p_referred
    and referral_rewarded_at is null
    and referred_by is not null
  returning referred_by into v_referrer;

  if v_referrer is null then
    return null;
  end if;

  update public.drivers
  set referral_days_granted = referral_days_granted + 14
  where id = v_referrer;

  return v_referrer;
end;
$$;

create or replace function public.unclaim_referral_reward(p_referred uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer uuid;
begin
  update public.drivers
  set referral_rewarded_at = null
  where id = p_referred
    and referral_rewarded_at is not null
  returning referred_by into v_referrer;

  if v_referrer is not null then
    update public.drivers
    set referral_days_granted = greatest(0, referral_days_granted - 14)
    where id = v_referrer;
  end if;
end;
$$;

revoke all on function public.claim_referral_reward(uuid) from public;
revoke all on function public.claim_referral_reward(uuid) from anon;
revoke all on function public.claim_referral_reward(uuid) from authenticated;
grant execute on function public.claim_referral_reward(uuid) to service_role;

revoke all on function public.unclaim_referral_reward(uuid) from public;
revoke all on function public.unclaim_referral_reward(uuid) from anon;
revoke all on function public.unclaim_referral_reward(uuid) from authenticated;
grant execute on function public.unclaim_referral_reward(uuid) to service_role;

create or replace function public.submit_feedback(p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cleaned text;
  recent int;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  cleaned := trim(coalesce(p_body, ''));
  if cleaned = '' then
    raise exception 'Feedback is empty' using errcode = '22023';
  end if;
  if char_length(cleaned) > 2000 then
    raise exception 'Feedback is too long' using errcode = '22023';
  end if;
  if not exists (select 1 from drivers where id = uid) then
    raise exception 'Driver not found';
  end if;
  select count(*) into recent
  from feedback
  where driver_id = uid and created_at > now() - interval '1 hour';
  if recent >= 5 then
    raise exception 'Too many feedback messages' using errcode = 'P0001';
  end if;
  insert into feedback (driver_id, body) values (uid, cleaned);
end;
$$;

revoke all on function public.submit_feedback(text) from public;
revoke all on function public.submit_feedback(text) from anon;
grant execute on function public.submit_feedback(text) to authenticated;
```

- [ ] **Step 3: Apply live** via Supabase MCP `apply_migration` with the same SQL, name `feedback_and_referral`.

- [ ] **Step 4: Verify**

```sql
select referral_code, referred_by, referral_days_granted from public.drivers;
select proname from pg_proc where proname in (
  'claim_referral','submit_feedback','claim_referral_reward','unclaim_referral_reward'
);
```

Expected: every `referral_code` matches `^FD[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$`; all four RPCs exist; `ensure_trial_driver` still inserts `now() + interval '7 days'`.

- [ ] **Step 5: Commit** `feat: add feedback table and referral columns`

---

### Task 4: Persist `?ref=` and claim after OTP

**Files:**
- Create: `lib/referral/storage.ts`
- Modify: `app/login/LoginForm.tsx` (`afterAuth`)

**Interfaces:**
- Consumes: `normalizeReferralCode`, `isValidReferralCode`, RPC `claim_referral`
- Produces: `readStoredReferralCode()`, `rememberReferralCodeFromUrl()`

- [ ] **Step 1: `lib/referral/storage.ts`**

```ts
import { isValidReferralCode, normalizeReferralCode } from "./code";

export const REFERRAL_STORAGE_KEY = "fuel-dip-ref";

export function rememberReferralCodeFromUrl(ref: string | null): void {
  if (typeof window === "undefined") return;
  const code = normalizeReferralCode(ref);
  if (!isValidReferralCode(code)) return;
  try {
    sessionStorage.setItem(REFERRAL_STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
}

export function readStoredReferralCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const code = sessionStorage.getItem(REFERRAL_STORAGE_KEY);
    return isValidReferralCode(code) ? normalizeReferralCode(code) : null;
  } catch {
    return null;
  }
}

export function clearStoredReferralCode(): void {
  try {
    sessionStorage.removeItem(REFERRAL_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
```

- [ ] **Step 2: In `LoginForm`**

On mount (existing `useEffect` or new): `rememberReferralCodeFromUrl(searchParams.get("ref"))`.

In `afterAuth` after `ensure_trial_driver()`:

```ts
const ref = readStoredReferralCode();
if (ref) {
  await supabase.rpc("claim_referral", { p_code: ref });
  clearStoredReferralCode();
}
```

Do not fail login if claim no-ops.

- [ ] **Step 3: `npx vitest run lib/referral/` && `npm run typecheck`**
- [ ] **Step 4: Commit** `feat: claim referral code after phone verify`

---

### Task 5: Grant reward from webhook + sync

**Files:**
- Create: `lib/referral/applyGrant.ts`
- Create: `lib/referral/applyGrant.test.ts`
- Create: `lib/stripe/extendSubscription.ts`
- Modify: `app/api/stripe/webhook/route.ts`
- Modify: `app/api/stripe/sync/route.ts`

**Interfaces:**
- Consumes: `decideReferralGrant`, `nextTrialEndsAt`, `stripeTrialEndUnix`, `createAdminClient`, `getStripe`
- Produces: `applyReferralGrantForDriver(admin, referredId, referredStatus)`

**Re-entry (document in `applyGrant.ts`):** `subscriptions.update({trial_end})` on the referrer emits `customer.subscription.updated`, which hits our webhook and re-runs the grant for the **referrer**. It terminates because that referrer’s `referral_rewarded_at` is unrelated — wait: the webhook runs grant **for the driver whose subscription updated**, which is the **referrer**, not the referred friend.

Clarify: webhook is invoked for the referrer’s subscription after we extend it. `applyReferralGrantForDriver(admin, referrerId)` loads the **referrer** as “referred”. The referrer typically has `referred_by` null (or already-rewarded if they were themselves referred). `decideReferralGrant` returns null → stop. Additionally, even if we called it for the original referred id, `referral_rewarded_at` is already set so the claim RPC returns null.

After a credit, a paying referrer’s `subscription_status` becomes `"trialing"`. `isActiveSubscriptionStatus` already accepts that, so the calculator still shows **Plan active**.

**Crash window:** a hard process kill between `claim_referral_reward` and `unclaim_referral_reward` is the one remaining hole: Stripe retries, hits the claim guard, and stops. Repair: `UPDATE drivers SET referral_rewarded_at = null WHERE id = '<referred>'` (then run `unclaim_referral_reward` or also subtract 14 from the referrer if days were incremented). Prefer calling `unclaim_referral_reward` from SQL as the repair.

- [ ] **Step 1: `lib/stripe/extendSubscription.ts`**

```ts
import type Stripe from "stripe";
import { stripeTrialEndUnix } from "@/lib/referral/grant";
import { periodEndIso } from "@/lib/billing/syncSubscription";

export async function extendStripeRenewalByBonusDays(
  stripe: Stripe,
  subscriptionId: string,
): Promise<void> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const trialEnd = stripeTrialEndUnix(
    periodEndIso(sub),
    Math.floor(Date.now() / 1000),
  );
  await stripe.subscriptions.update(subscriptionId, {
    trial_end: trialEnd,
    proration_behavior: "none",
  });
}
```

Export `periodEndIso` from `lib/billing/syncSubscription.ts` (already exported).

- [ ] **Step 2: Write failing `applyGrant.test.ts`** — stub admin client. Referrer with `trial_ends_at` null → no company `update`, `unclaim_referral_reward` called, `referral_days_granted` back to prior value (unclaim RPC invoked). Also a success path that claims then updates company.

- [ ] **Step 3: Complete typed `lib/referral/applyGrant.ts`**

```ts
/**
 * Claim-then-apply referral credit.
 *
 * Race: Checkout return polls /api/stripe/sync while the webhook fires.
 * claim_referral_reward is the atomic CAS (referral_rewarded_at IS NULL).
 *
 * Re-entry: extending the referrer's Stripe sub emits customer.subscription.updated,
 * which re-runs this for the referrer. decideReferralGrant / claim returns null.
 *
 * After a credit, a paying referrer's subscription_status becomes "trialing";
 * isActiveSubscriptionStatus already accepts that → calculator still shows Plan active.
 *
 * Crash window: a hard kill between claim_referral_reward and unclaim_referral_reward
 * leaves referral_rewarded_at set. Stripe retries hit the claim guard and stop.
 * Repair: SELECT unclaim_referral_reward('<referred-uuid>'::uuid);
 */
export async function applyReferralGrantForDriver(
  admin: SupabaseClient,
  referredId: string,
  referredStatus?: string | null,
): Promise<void> {
  // load referred + referrer with maybeSingle; null-check
  // decideReferralGrant; return if null
  // claim_referral_reward; return if null
  // try {
  //   trial: next = nextTrialEndsAt(...); if next == null throw; else update company
  //   stripe: extendStripeRenewalByBonusDays
  // } catch {
  //   await admin.rpc("unclaim_referral_reward", { p_referred: referredId });
  //   throw;
  // }
}
```

Null `trial_ends_at` **throws** after claim so the catch unclaims. Do **not** keep the claim when nothing was granted.

- [ ] **Step 4: Webhook** — after successful driver update, if status is `"active"`, `await applyReferralGrantForDriver(...)`. Let throw produce **500**.

- [ ] **Step 5: Sync** — after successful update when `best.status` is `"active"`, wrap grant in try/catch: **log and continue**. Do not fail the sync JSON over a referral credit.

- [ ] **Step 6: `npm run lint && npm run typecheck && npm test`**
- [ ] **Step 7: Commit** `feat: grant 14-day referral credit after friend pays`

---

### Task 6: Feedback page + middleware

**Files:**
- Create: `app/feedback/page.tsx`
- Create: `lib/feedback/submit.ts` (optional thin wrapper)
- Modify: `lib/supabase/middleware.ts`

`lib/supabase/middleware.ts` line 70 only access-gates `/calculator`, `/history`, and `/`. `/feedback` is **already auth-only**. The **single** needed change is adding it to `isAuthOnly` (line 44) so the login redirect preserves `?next=/feedback`. Do not hunt for a gate to remove.

`/feedback` is **not** precached by the service worker, so it is unreachable offline. The “Needs network.” copy only covers losing connectivity while the page is already open. **Accepted for v1** — do not add a precache route. `next.config.ts` must keep precaching `/~offline` only.

- [ ] **Step 1: Middleware**

```ts
const isAuthOnly = path === "/subscribe" || path === "/feedback";
```

- [ ] **Step 2: Page** (client form, phone-login styling: `min-h-12`, CSS vars)

```tsx
"use client";
// textarea required, maxLength 2000
// supabase.rpc("submit_feedback", { p_body: text })
// success: "Thanks — we got it."
// error P0001 → "Try again in an hour."
// navigator.onLine === false → disable + "Needs network."
```

May **render** existing `SiteFooter`; do **not** edit that file. Header: “Feedback”.

- [ ] **Step 3: Typecheck**
- [ ] **Step 4: Commit** `feat: add in-app feedback form`

---

### Task 7: Share button + nav links

**Files:**
- Modify: `app/calculator/CalculatorClient.tsx` header (near History)
- Modify: `app/guide/page.tsx` — one section on Share
- Modify: `app/terms/page.tsx` — one sentence on referral credit

Do **not** modify `app/components/SiteFooter.tsx`.

**Share click:**

```ts
const origin = window.location.origin;
const { data } = await supabase.from("drivers").select("referral_code").eq("id", user.id).maybeSingle();
const url = `${origin}/login?ref=${data.referral_code}`;
const text = "Fuel Dip Calculator — 7-day trial. If you subscribe, I get 14 extra days.";
if (navigator.share) {
  await navigator.share({ title: "Fuel Dip Calculator", text, url });
} else {
  await navigator.clipboard.writeText(url);
  // flash "Link copied"
}
```

Load `referral_code` once during existing online driver fetch (add to the `select` list).

Header links: `Feedback` (Link `/feedback`), `Share` (button).

If `referral_days_granted > 0` and not dismissed this session, optional one-liner under header: “Referral: you have N extra days from sharing.” Keep it one line.

- [ ] **Step 1: Implement UI**
- [ ] **Step 2: `npm run lint && npm run typecheck && npm test`**
- [ ] **Step 3: Commit** `feat: add Share referral link and Feedback nav`
- [ ] **Step 4: Update `CLAUDE.md`** still-open / what’s built with feedback + referral; commit `docs: note feedback form and referral share`

---

## Manual test plan

1. Driver A: calculator → Share → copy link. Open in private window as new phone B.
2. B verifies OTP, saves nothing, A’s trial unchanged.
3. B subscribes (or Stripe test clock / live $2.99). A’s `trial_ends_at` or Stripe period +14. B `referral_rewarded_at` set. Repeat webhook/sync → no second grant.
4. A shares own link to A → `referred_by` stays null.
5. `/feedback` while online: message appears in `feedback`. 6th in one hour errors. Airplane: Needs network.
6. Expired trial user can still open `/feedback` (middleware auth-only).
7. Concurrent webhook + `/api/stripe/sync` after one checkout produce exactly **one** 14-day credit.
8. The credit’s own `subscription.updated` webhook does **not** re-grant.
9. A driver whose `trial_ends_at` is **null**: no company update, claim released, `referral_days_granted` unchanged; later `/api/stripe/sync` retries if they ever get a real trial clock. No Invalid Date written.
10. A driver whose trial expired **>14 days ago**: extend from `now`, not a still-past timestamp.

---

## Self-review

- Spec: form, share button, pay-to-credit, trial vs Stripe, self-referral, idempotent reward, 5/hour feedback, no outbox — all have tasks.
- SiteFooter not in file map (decision B).
- `ensure_trial_driver` is inlined verbatim (7-day trial); no TBD merge comment.
- Backfill translate is on the **primary** update; verification regex asserts alphabet.
- Claim-then-apply + unclaim on any failure, including null `trial_ends_at`.
- Webhook 500 vs sync log-and-continue documented.
- Crash-window repair documented.
- Names: `claim_referral`, `submit_feedback`, `claim_referral_reward`, `unclaim_referral_reward`, `hasPaidStatus`, `decideReferralGrant`, `applyReferralGrantForDriver`, `nextTrialEndsAt`, `REFERRAL_BONUS_DAYS = 14`.
