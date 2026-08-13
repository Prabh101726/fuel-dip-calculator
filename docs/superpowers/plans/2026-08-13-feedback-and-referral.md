# Feedback + Referral Share Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drivers send private in-app feedback and share a personal signup link; when that friend **pays**, the sharer gets **14 extra days** (trial clock or Stripe renewal).

**Architecture:** Unique `referral_code` on `drivers`. Login `?ref=` → `sessionStorage` → `claim_referral` RPC after OTP. Stripe webhook/sync, after writing `active`, runs `grantReferralRewardIfEligible`. Feedback is an auth-only `/feedback` page calling `submit_feedback` (5/hour). No new vendors.

**Tech Stack:** Next.js App Router, Supabase RPC + RLS, existing Stripe Node SDK + webhook/sync routes, Vitest.

**Spec:** [`docs/superpowers/specs/2026-08-13-feedback-and-referral-design.md`](../specs/2026-08-13-feedback-and-referral-design.md)

## Global Constraints

- Bonus: **14 days**; friend trial stays **7 days**
- Credit **sharer only**, only after referred driver is **paid/active**
- Paid sharer: Stripe `trial_end` = period end + 14d, `proration_behavior: 'none'`
- Trial sharer: `companies.trial_ends_at` + 14 days
- Phone OTP only; do not reintroduce email signup UI
- Do not change `lib/dip-calculator/` math
- Do not `supabase config push`
- Do not put feedback in the dip-calc offline outbox
- Do not cache Stripe/Supabase REST in the service worker
- Referral codes are not secrets
- Apply live SQL via Supabase MCP `apply_migration` **and** keep a matching file under `supabase/migrations/`

## File map

| Path | Responsibility |
| --- | --- |
| `lib/referral/code.ts` | Generate / validate `FD` + 4-char codes |
| `lib/referral/code.test.ts` | Code tests |
| `lib/referral/storage.ts` | `sessionStorage` key `fuel-dip-ref` |
| `lib/referral/grant.ts` | Pure: skip/self/already-rewarded; trial vs Stripe path |
| `lib/referral/grant.test.ts` | Grant decision tests |
| `lib/feedback/submit.ts` | Client helper for `submit_feedback` RPC |
| `supabase/migrations/YYYYMMDDHHMMSS_feedback_and_referral.sql` | Columns, `feedback`, RPCs, RLS |
| `app/api/stripe/webhook/route.ts` | After driver patch, grant if active |
| `app/api/stripe/sync/route.ts` | Same grant after sync |
| `lib/stripe/extendSubscription.ts` | Stripe `subscriptions.update` trial_end |
| `app/login/LoginForm.tsx` | Persist `?ref=`, `claim_referral` after auth |
| `app/feedback/page.tsx` | Form UI |
| `app/calculator/CalculatorClient.tsx` | Share + Feedback header links |
| `app/components/SiteFooter.tsx` | Feedback link |
| `lib/supabase/middleware.ts` | `/feedback` auth-only (no access gate) |
| `app/guide/page.tsx` / `app/terms/page.tsx` | Copy |
| `CLAUDE.md` | Status note |

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

- [ ] **Step 5: Commit**

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
- Produces: `REFERRAL_BONUS_DAYS`, `decideReferralGrant()`, `addDaysIso()`, `stripeTrialEndUnix()`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import {
  REFERRAL_BONUS_DAYS,
  addDaysIso,
  decideReferralGrant,
  stripeTrialEndUnix,
} from "./grant";

const referred = {
  id: "new-1",
  referred_by: "sharer-1",
  referral_rewarded_at: null as string | null,
};
const sharerTrial = {
  id: "sharer-1",
  subscription_status: null as string | null,
  stripe_subscription_id: null as string | null,
};
const sharerPaid = {
  id: "sharer-1",
  subscription_status: "active",
  stripe_subscription_id: "sub_1",
};

describe("decideReferralGrant", () => {
  it("skips when unpaid friend or already rewarded or self", () => {
    expect(
      decideReferralGrant({
        referredStatus: "incomplete",
        referred,
        referrer: sharerTrial,
      }),
    ).toBeNull();
    expect(
      decideReferralGrant({
        referredStatus: "active",
        referred: { ...referred, referral_rewarded_at: "2026-01-01T00:00:00Z" },
        referrer: sharerTrial,
      }),
    ).toBeNull();
    expect(
      decideReferralGrant({
        referredStatus: "active",
        referred: { ...referred, referred_by: "new-1", id: "new-1" },
        referrer: { ...sharerTrial, id: "new-1" },
      }),
    ).toBeNull();
  });

  it("extends trial when sharer is not subscribed", () => {
    const d = decideReferralGrant({
      referredStatus: "active",
      referred,
      referrer: sharerTrial,
    });
    expect(d).toEqual({ kind: "trial", referrerId: "sharer-1", referredId: "new-1" });
  });

  it("extends Stripe when sharer is paid", () => {
    const d = decideReferralGrant({
      referredStatus: "active",
      referred,
      referrer: sharerPaid,
    });
    expect(d).toEqual({
      kind: "stripe",
      referrerId: "sharer-1",
      referredId: "new-1",
      subscriptionId: "sub_1",
    });
  });
});

describe("time helpers", () => {
  it("adds 14 days to an ISO timestamp", () => {
    expect(REFERRAL_BONUS_DAYS).toBe(14);
    expect(addDaysIso("2026-08-13T00:00:00.000Z", 14)).toBe(
      "2026-08-27T00:00:00.000Z",
    );
  });

  it("sets Stripe trial_end to period end plus 14 days", () => {
    const period = "2026-09-10T00:00:00.000Z";
    const unix = stripeTrialEndUnix(period, Date.parse("2026-08-13T00:00:00Z") / 1000);
    expect(unix).toBe(Date.parse("2026-09-24T00:00:00.000Z") / 1000);
  });
});
```

- [ ] **Step 2: Run to verify fail** — `npx vitest run lib/referral/grant.test.ts`

- [ ] **Step 3: Implement**

```ts
import { isActiveSubscriptionStatus } from "@/lib/billing/access";

export const REFERRAL_BONUS_DAYS = 14;

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
  if (!isActiveSubscriptionStatus(input.referredStatus)) return null;
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
- [ ] **Step 5: Commit** `feat: decide referral grant trial vs Stripe`

---

### Task 3: Migration — columns, feedback, RPCs

**Files:**
- Create via `supabase migration new feedback_and_referral`
- Apply live with MCP `apply_migration` (same SQL)

**Notes:** Backfill `referral_code` for existing 4 phone drivers. `ensure_trial_driver` must set a unique code on insert (retry on unique violation). Keep 7-day trial insert unchanged.

- [ ] **Step 1: Create migration file**

Run: `supabase migration new feedback_and_referral`

- [ ] **Step 2: Write SQL** (full file contents)

```sql
alter table public.drivers
  add column if not exists referral_code text,
  add column if not exists referred_by uuid references public.drivers (id),
  add column if not exists referral_rewarded_at timestamptz,
  add column if not exists referral_days_granted integer not null default 0;

-- Backfill unique codes for existing rows (deterministic-enough from id).
update public.drivers d
set referral_code = 'FD' || upper(substr(replace(d.id::text, '-', ''), 1, 4))
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
      candidate := 'FD' || upper(substr(md5(r.id::text || n::text), 1, 4));
      -- alphabet filter: rewrite 0,1,O,I if they appear
      candidate := translate(candidate, '01OI', '2345');
    end loop;
    update public.drivers set referral_code = candidate where id = r.id;
  end loop;
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

-- Patch ensure_trial_driver: on insert, set referral_code (keep existing 7-day trial).
-- Copy the live function body from 20260804120000 + phone naming, and add:
--   insert into drivers (id, company_id, role, referral_code)
--   values (uid, new_company_id, 'driver', <unique FD code>);
-- Read current definition with:
--   select pg_get_functiondef(oid) from pg_proc where proname = 'ensure_trial_driver';
-- Merge; do not reset trial_ends_at for existing drivers.

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

When replacing `ensure_trial_driver`, pull the **current** live definition first (phone-aware, 7-day trial) and only add `referral_code` on the insert. Do not revert trial to 14 days.

- [ ] **Step 3: Apply live** via Supabase MCP `apply_migration` with the same SQL, name `feedback_and_referral`.

- [ ] **Step 4: Verify**

```sql
select referral_code, referred_by, referral_days_granted from public.drivers;
select proname from pg_proc where proname in ('claim_referral','submit_feedback');
```

Expected: every driver has a `FD….` code; both RPCs exist.

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
- Create: `lib/stripe/extendSubscription.ts`
- Modify: `app/api/stripe/webhook/route.ts`
- Modify: `app/api/stripe/sync/route.ts`

**Interfaces:**
- Consumes: `decideReferralGrant`, `addDaysIso`, `stripeTrialEndUnix`, `createAdminClient`, `getStripe`
- Produces: `applyReferralGrantForDriver(admin, referredId, referredStatus)`

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

- [ ] **Step 2: `lib/referral/applyGrant.ts`** — load referred + referrer via admin, `decideReferralGrant`, then:

```ts
if (decision.kind === "trial") {
  const { data: drv } = await admin.from("drivers").select("company_id").eq("id", decision.referrerId).single();
  const { data: company } = await admin.from("companies").select("trial_ends_at").eq("id", drv.company_id).single();
  const next = addDaysIso(company.trial_ends_at, REFERRAL_BONUS_DAYS);
  await admin.from("companies").update({ trial_ends_at: next }).eq("id", drv.company_id);
} else {
  await extendStripeRenewalByBonusDays(getStripe(), decision.subscriptionId);
}
await admin.from("drivers").update({ referral_rewarded_at: new Date().toISOString() }).eq("id", decision.referredId);
await admin.rpc(/* or */) // increment referral_days_granted:
await admin.from("drivers").update({
  referral_days_granted: (referrer.referral_days_granted ?? 0) + REFERRAL_BONUS_DAYS,
}).eq("id", decision.referrerId);
```

Use a select of `referral_days_granted` first, then update. Swallow Stripe errors into `console.error` and **do not** mark `referral_rewarded_at` if Stripe extend failed (so sync can retry). Mark rewarded only after success.

- [ ] **Step 3: Call from webhook** after successful driver update, if `patch.subscription_status` is active (or existing row after patch is active):

```ts
const referredId = data[0].id;
await applyReferralGrantForDriver(admin, referredId);
```

`applyReferralGrantForDriver` re-reads the driver (status, referred_by, rewarded_at) so it works for webhook and sync.

- [ ] **Step 4: Call from sync** after successful update when `best.status` is active.

- [ ] **Step 5: `npm run typecheck` && `npx vitest run lib/referral lib/billing`**
- [ ] **Step 6: Commit** `feat: grant 14-day referral credit after friend pays`

---

### Task 6: Feedback page + middleware

**Files:**
- Create: `app/feedback/page.tsx`
- Create: `lib/feedback/submit.ts` (optional thin wrapper)
- Modify: `lib/supabase/middleware.ts` — treat `/feedback` like `/subscribe` (signed-in, skip `my_access_active`)

- [ ] **Step 1: Middleware**

Set `isAuthOnly = path === "/subscribe" || path === "/feedback"` (and keep `next` query on login redirect).

- [ ] **Step 2: Page** (client form, phone-login styling: `min-h-12`, CSS vars)

```tsx
"use client";
// textarea required, maxLength 2000
// supabase.rpc("submit_feedback", { p_body: text })
// success: "Thanks — we got it."
// error P0001 → "Try again in an hour."
// navigator.onLine === false → disable + "Needs network."
```

Include `SiteFooter`. Header: “Feedback”.

- [ ] **Step 3: Typecheck**
- [ ] **Step 4: Commit** `feat: add in-app feedback form`

---

### Task 7: Share button + nav links

**Files:**
- Modify: `app/calculator/CalculatorClient.tsx` header (near History)
- Modify: `app/components/SiteFooter.tsx` — `{ href: "/feedback", label: "Feedback" }`
- Modify: `app/guide/page.tsx` — one section on Share
- Modify: `app/terms/page.tsx` — one sentence on referral credit

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

---

## Self-review

- Spec: form, share button, pay-to-credit, trial vs Stripe, self-referral, idempotent reward, 5/hour feedback, no outbox — all have tasks.
- No TBD in task steps. `ensure_trial_driver` merge is explicit: read live def, don’t revert 7-day trial.
- Names: `claim_referral`, `submit_feedback`, `decideReferralGrant`, `applyReferralGrantForDriver`, `REFERRAL_BONUS_DAYS = 14`.
