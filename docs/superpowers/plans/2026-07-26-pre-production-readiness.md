# Pre-Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Soft-launch harden the live Fuel Dip Calculator: email confirmation redirects, 7-day trials for new companies, Privacy/Terms, safety reminders, forgot-password, and $4.99 coming-soon messaging — no Stripe.

**Architecture:** Keep open signup. Wire Supabase confirm/reset emails to absolute app URLs (`emailRedirectTo` / `redirectTo`). New companies get a 7-day `trial_ends_at` via migration + `ensure_trial_driver()` change. Public `/privacy` and `/terms` pages; shared constants for contact email and safety copy. Password recovery lands on `/auth/reset-password`, which exchanges the PKCE code itself and never runs the trial gate.

**Tech Stack:** Next.js App Router (TypeScript), Supabase Auth (`@supabase/ssr`), Postgres migration, Vitest, existing Tailwind/`globals.css` tokens.

**Spec:** `docs/superpowers/specs/2026-07-26-pre-production-readiness-design.md`

## Global Constraints

- Contact email everywhere: `contact@detours-app.com`
- Operator name: `SRV Freight Inc`
- New trial length: **7 days**; do **not** rewrite existing `companies.trial_ends_at`
- Safety copy (exact): `Safety first: always verify the physical tank tag matches the chart number and given site plan Tank charts before delivery.`
- Planned price copy: `$4.99/month` — messaging only, no Stripe/schema
- `signUp` must pass `options.emailRedirectTo` → `{origin}/auth/callback`
- `resetPasswordForEmail` must pass `redirectTo` → `{origin}/auth/reset-password`
- **Reset-password must NOT go through `/auth/callback`** (that route runs the trial gate and would bounce expired-trial users to `/trial-ended` before they can set a password). `/auth/reset-password` exchanges the code itself (or via middleware session refresh) and skips all trial checks.
- Do not enable Supabase “Confirm email” in the dashboard until this code is **deployed** and redirect allow-list entries exist (ops ordering in Task 9)
- Do not touch `lib/dip-calculator/` calculation logic
- No new product tables
- YAGNI: no invite codes, disposable-email block, Sentry, signature capture

## File map

| File | Responsibility |
| --- | --- |
| `lib/app-copy.ts` | Shared constants: contact email, safety reminder, trial days label helpers |
| `lib/app-copy.test.ts` | Unit tests for constants / URL helpers |
| `supabase/migrations/20260726175154_seven_day_trial.sql` | Default + `ensure_trial_driver()` → 7 days |
| `lib/supabase/middleware.ts` | Public allow-list: `/privacy`, `/terms` |
| `app/privacy/page.tsx` | Privacy Policy page |
| `app/terms/page.tsx` | Terms of Use page |
| `app/login/LoginForm.tsx` | Redirects, checkbox, forgot-password, safety, 7-day copy, legal links |
| `app/auth/reset-password/page.tsx` | Client page: exchange code, set new password, no trial gate |
| `app/calculator/CalculatorClient.tsx` | Safety banner + legal footer |
| `app/history/page.tsx` | Legal footer |
| `app/trial-ended/page.tsx` | 7-day + $4.99 + contact copy + legal footer |
| `CLAUDE.md` | Document ops ordering + what shipped |

---

### Task 1: Shared app copy + auth redirect URL helpers

**Files:**
- Create: `lib/app-copy.ts`
- Create: `lib/app-copy.test.ts`

**Interfaces:**
- Produces:
  - `CONTACT_EMAIL = "contact@detours-app.com"`
  - `SAFETY_REMINDER = "Safety first: always verify the physical tank tag matches the chart number and given site plan Tank charts before delivery."`
  - `TRIAL_DAYS = 7`
  - `authCallbackUrl(origin: string): string`
  - `resetPasswordUrl(origin: string): string`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import {
  CONTACT_EMAIL,
  SAFETY_REMINDER,
  TRIAL_DAYS,
  authCallbackUrl,
  resetPasswordUrl,
} from "./app-copy";

describe("app-copy", () => {
  it("locks contact, safety, and trial length", () => {
    expect(CONTACT_EMAIL).toBe("contact@detours-app.com");
    expect(SAFETY_REMINDER).toContain("tank tag");
    expect(TRIAL_DAYS).toBe(7);
  });

  it("builds auth redirect URLs without trailing junk", () => {
    expect(authCallbackUrl("https://fuel-dip-calculator.vercel.app")).toBe(
      "https://fuel-dip-calculator.vercel.app/auth/callback",
    );
    expect(resetPasswordUrl("https://fuel-dip-calculator.vercel.app")).toBe(
      "https://fuel-dip-calculator.vercel.app/auth/reset-password",
    );
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx vitest run lib/app-copy.test.ts`  
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `lib/app-copy.ts`**

```ts
export const CONTACT_EMAIL = "contact@detours-app.com";

export const SAFETY_REMINDER =
  "Safety first: always verify the physical tank tag matches the chart number and given site plan Tank charts before delivery.";

export const TRIAL_DAYS = 7;

export function authCallbackUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}/auth/callback`;
}

export function resetPasswordUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}/auth/reset-password`;
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run lib/app-copy.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/app-copy.ts lib/app-copy.test.ts
git commit -m "feat: add shared pre-prod copy and auth URL helpers"
```

---

### Task 2: Seven-day trial migration

**Files:**
- Create: `supabase/migrations/20260726175154_seven_day_trial.sql`

**Interfaces:**
- Consumes: existing `ensure_trial_driver()` / `companies.trial_ends_at`
- Produces: new default + function body use `interval '7 days'`; existing rows untouched

- [ ] **Step 1: Add migration SQL**

```sql
-- New companies get a 7-day trial. Existing trial_ends_at values are left unchanged.

alter table companies
  alter column trial_ends_at set default (now() + interval '7 days');

create or replace function ensure_trial_driver()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  user_email text;
  company_name text;
  new_company_id uuid;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if exists (select 1 from drivers where id = uid) then
    return;
  end if;

  select u.email into user_email from auth.users u where u.id = uid;
  company_name := coalesce(nullif(split_part(coalesce(user_email, ''), '@', 1), ''), 'Trial company');

  insert into companies (name, trial_ends_at)
  values (company_name, now() + interval '7 days')
  returning id into new_company_id;

  insert into drivers (id, company_id, role)
  values (uid, new_company_id, 'driver');
end;
$$;

revoke all on function ensure_trial_driver() from public;
revoke all on function ensure_trial_driver() from anon;
grant execute on function ensure_trial_driver() to authenticated;

comment on function ensure_trial_driver() is
  'First login/signup: provision company (7-day trial) + drivers row. No-op if driver exists.';
comment on column companies.trial_ends_at is
  'Trial expiry; access to calculator/history denied after this timestamp. New companies default to 7 days.';
```

- [ ] **Step 2: Push migration to linked remote**

Run: `supabase db push`  
Expected: migration applied successfully (project already linked). If CLI prompts, confirm.

- [ ] **Step 3: Spot-check (SQL)**

Via Supabase SQL editor or `supabase db execute`:

```sql
select pg_get_expr(adbin, adrelid)
from pg_attrdef
join pg_attribute on attrelid = adrelid and adnum = adnum
where adrelid = 'companies'::regclass and attname = 'trial_ends_at';
```

Expected: expression includes `7 days`. Do **not** run an update that rewrites existing rows.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260726175154_seven_day_trial.sql
git commit -m "feat: shorten new company trials to 7 days"
```

---

### Task 3: Middleware — public `/privacy` and `/terms`

**Files:**
- Modify: `lib/supabase/middleware.ts`

**Interfaces:**
- Consumes: existing `isPublic` check
- Produces: logged-out users can open `/privacy` and `/terms`

- [ ] **Step 1: Update public path check**

In `lib/supabase/middleware.ts`, change the `isPublic` block to:

```ts
  const isPublic =
    path === "/login" ||
    path.startsWith("/auth/") ||
    path === "/trial-ended" ||
    path === "/privacy" ||
    path === "/terms";
```

No other middleware logic changes. `/auth/reset-password` is already covered by `path.startsWith("/auth/")`. Do **not** add trial checks on `/auth/*`.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`  
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/middleware.ts
git commit -m "fix: allow public access to privacy and terms"
```

---

### Task 4: Privacy + Terms pages

**Files:**
- Create: `app/privacy/page.tsx`
- Create: `app/terms/page.tsx`

**Interfaces:**
- Consumes: `CONTACT_EMAIL` from `lib/app-copy.ts`
- Produces: public pages at `/privacy` and `/terms`

- [ ] **Step 1: Create `app/privacy/page.tsx`**

Use existing dark theme tokens (`--text`, `--muted`, `--accent`). Include Link back to `/login`. Full content:

```tsx
import Link from "next/link";
import { CONTACT_EMAIL } from "@/lib/app-copy";

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-lg px-4 py-10">
      <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">
        Fuel Dip Calculator
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--text)]">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Operated by SRV Freight Inc. Last updated: July 26, 2026.
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-[var(--text)]">
        <section className="space-y-2">
          <h2 className="text-base font-bold">What we collect</h2>
          <p className="text-[var(--muted)]">
            When you create an account we store your email address and
            authentication identifiers from Supabase Auth. When you use the
            calculator we store company and trial metadata, and any dip
            calculations you save (tank chart selection, dips, volumes, location
            label, typed signature name, and related discharge fields).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">Shared reference data</h2>
          <p className="text-[var(--muted)]">
            Dip chart catalog data (tank types and dip/volume points) is shared
            reference information used by the app. It is not personal data and
            is not owned by an individual driver account.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">How we use data</h2>
          <p className="text-[var(--muted)]">
            We use this information to provide the calculator, keep your history,
            enforce trial access, and operate and secure the service. We do not
            sell your personal data.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">Retention</h2>
          <p className="text-[var(--muted)]">
            We keep account and calculation data while your account is active and
            as needed to operate the service, meet legal obligations, or resolve
            disputes.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">Contact</h2>
          <p className="text-[var(--muted)]">
            Privacy questions:{" "}
            <a
              className="font-bold text-[var(--accent)]"
              href={`mailto:${CONTACT_EMAIL}`}
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </section>
      </div>

      <p className="mt-10">
        <Link href="/login" className="text-sm font-bold text-[var(--accent)]">
          Back to sign in
        </Link>
      </p>
    </main>
  );
}
```

- [ ] **Step 2: Create `app/terms/page.tsx`**

```tsx
import Link from "next/link";
import { CONTACT_EMAIL, TRIAL_DAYS } from "@/lib/app-copy";

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-lg px-4 py-10">
      <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">
        Fuel Dip Calculator
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--text)]">
        Terms of Use
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Operated by SRV Freight Inc. Last updated: July 26, 2026.
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-[var(--text)]">
        <section className="space-y-2">
          <h2 className="text-base font-bold">The service</h2>
          <p className="text-[var(--muted)]">
            Fuel Dip Calculator helps fuel delivery drivers convert tank dip
            readings to volumes and estimate safe discharge headroom using
            published dip charts. It is a web tool for signed-in users.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">Safety and your responsibility</h2>
          <p className="text-[var(--muted)]">
            Always verify that the physical tank tag matches the chart number
            selected in the app before delivery. This tool assists with
            calculations; it does not replace site procedures, the Safe
            Discharge Sheet process, or your professional judgment. You are
            responsible for safe discharge decisions in the field.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">Trial and paid plans</h2>
          <p className="text-[var(--muted)]">
            New accounts receive a {TRIAL_DAYS}-day trial. We plan to offer paid
            access at $4.99 per month per account. Payment processing is not
            live yet; after the trial, calculator and history access may be
            locked until a paid plan is available or access is arranged.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">Acceptable use</h2>
          <p className="text-[var(--muted)]">
            Use the service only for lawful fuel-delivery operations. Do not
            attempt to disrupt the service, access other companies&apos; data,
            or misuse trial access.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">Limitation of liability</h2>
          <p className="text-[var(--muted)]">
            The service is provided as-is for operational assistance. To the
            fullest extent permitted by law, SRV Freight Inc is not liable for
            spills, overfills, delivery errors, or other damages arising from
            reliance on the calculator. Use verified tank tags and site
            procedures.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">Governing law</h2>
          <p className="text-[var(--muted)]">
            These terms are governed by the laws of the Province of Ontario and
            the applicable laws of Canada.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">Contact</h2>
          <p className="text-[var(--muted)]">
            Questions:{" "}
            <a
              className="font-bold text-[var(--accent)]"
              href={`mailto:${CONTACT_EMAIL}`}
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </section>
      </div>

      <p className="mt-10">
        <Link href="/login" className="text-sm font-bold text-[var(--accent)]">
          Back to sign in
        </Link>
      </p>
    </main>
  );
}
```

- [ ] **Step 3: Typecheck + build pages**

Run: `npm run typecheck`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add app/privacy/page.tsx app/terms/page.tsx
git commit -m "feat: add privacy policy and terms of use pages"
```

---

### Task 5: Login — redirects, legal checkbox, forgot password, safety, 7-day copy

**Files:**
- Modify: `app/login/LoginForm.tsx`

**Interfaces:**
- Consumes: `CONTACT_EMAIL` (not required on login body), `SAFETY_REMINDER`, `TRIAL_DAYS`, `authCallbackUrl`, `resetPasswordUrl`
- Produces: production-safe signup confirm links; reset email; ToS gate

- [ ] **Step 1: Update imports and state**

Add:

```ts
import Link from "next/link";
import {
  SAFETY_REMINDER,
  TRIAL_DAYS,
  authCallbackUrl,
  resetPasswordUrl,
} from "@/lib/app-copy";
```

Add state:

```ts
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
```

- [ ] **Step 2: Wire `signUp` with `emailRedirectTo`**

Replace the `signUp` call with:

```ts
    const origin = window.location.origin;
    const { data, error } = await supabase.auth.signUp({
      email: trimmed,
      password,
      options: {
        emailRedirectTo: authCallbackUrl(origin),
      },
    });
```

And require legal acceptance before signup (at top of signup branch):

```ts
    if (!acceptedLegal) {
      setBusy(false);
      setIsError(true);
      setMessage("Please agree to the Terms of Use and Privacy Policy.");
      return;
    }
```

Update no-session message to:

```ts
      setMessage(
        "Account created. Check your email to confirm, then sign in.",
      );
```

- [ ] **Step 3: Add forgot-password submit path**

Before the sign-in / sign-up branches in `onSubmit`, handle forgot mode:

```ts
    if (forgotMode) {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: resetPasswordUrl(window.location.origin),
      });
      setBusy(false);
      if (error) {
        setIsError(true);
        setMessage(error.message || "Could not send reset email.");
        return;
      }
      setIsError(false);
      setMessage("Check your email for a password reset link.");
      return;
    }
```

When `forgotMode` is true, hide the password field and change the submit label to “Send reset link”. Provide a control to return to sign-in.

- [ ] **Step 4: UI — safety callout, 7-day copy, checkbox, legal links**

- Change subtitle from `14-day` to use `` `${TRIAL_DAYS}-day trial` ``
- Below the brand/title (before mode toggles), add:

```tsx
      <p className="mt-4 rounded-lg border border-[var(--warn)] bg-[var(--warn-bg)] px-3 py-2.5 text-sm font-medium text-[var(--warn-fg)]">
        {SAFETY_REMINDER}
      </p>
```

- In signup mode, before the submit button, add required checkbox with links:

```tsx
        {mode === "signup" && !forgotMode && (
          <label className="flex items-start gap-3 text-sm text-[var(--muted)]">
            <input
              type="checkbox"
              checked={acceptedLegal}
              onChange={(e) => setAcceptedLegal(e.target.checked)}
              className="mt-1"
              required
            />
            <span>
              I agree to the{" "}
              <Link href="/terms" className="font-bold text-[var(--accent)]">
                Terms of Use
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="font-bold text-[var(--accent)]">
                Privacy Policy
              </Link>
              .
            </span>
          </label>
        )}
```

- Under the form (sign-in mode): “Forgot password?” button that sets `forgotMode` true.
- Footer links to `/privacy` and `/terms` always visible on the login page.

- [ ] **Step 5: Lint / typecheck / test**

Run: `npm run lint && npm run typecheck && npm run test`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/login/LoginForm.tsx
git commit -m "feat: harden login with confirm redirects and legal gate"
```

---

### Task 6: Reset-password page (own code exchange, no trial gate)

**Files:**
- Create: `app/auth/reset-password/page.tsx`

**Interfaces:**
- Consumes: browser Supabase client; URL `?code=`
- Produces: password update for recovery sessions without touching `/auth/callback`

**Critical directive:** Do **not** redirect recovery links through `/auth/callback?next=/auth/reset-password`. That route calls `ensure_trial_driver()` and the trial gate, so an expired-trial user could never reach the form. This page must call `exchangeCodeForSession` itself when `code` is present, then `updateUser({ password })`. Skip all trial RPCs.

- [ ] **Step 1: Create the page**

```tsx
"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const code = searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (error) {
          setIsError(true);
          setMessage(error.message || "Reset link is invalid or expired.");
          setReady(false);
          return;
        }
      } else {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (cancelled) return;
        if (!session) {
          setIsError(true);
          setMessage("Open the reset link from your email, or request a new one.");
          setReady(false);
          return;
        }
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setIsError(false);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setIsError(true);
      setMessage(error.message || "Could not update password.");
      return;
    }
    setIsError(false);
    setMessage("Password updated. Signing you in…");
    router.replace("/calculator");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-12">
      <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">
        Fuel Dip Calculator
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--text)]">
        Set new password
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Choose a new password for your account. You do not need an active trial
        to reset your password.
      </p>

      {ready ? (
        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
              New password
            </span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="min-h-12 rounded-lg border border-[var(--border)] bg-[var(--input)] px-3.5 text-base text-[var(--text)] outline-none focus:border-[var(--accent)]"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="min-h-12 rounded-lg bg-[var(--accent)] px-4 text-base font-bold text-[var(--accent-fg)] disabled:opacity-60"
          >
            {busy ? "Saving…" : "Update password"}
          </button>
        </form>
      ) : null}

      {message !== "" && (
        <p
          className={`mt-4 text-sm font-medium ${
            isError ? "text-[var(--danger)]" : "text-[var(--success)]"
          }`}
          role="status"
        >
          {message}
        </p>
      )}

      <p className="mt-8">
        <Link href="/login" className="text-sm font-bold text-[var(--accent)]">
          Back to sign in
        </Link>
      </p>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-12 text-sm text-[var(--muted)]">
          Loading…
        </main>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
```

Note: after success, `router.replace("/calculator")` may send expired-trial users to `/trial-ended` via middleware — that is correct **after** the password was saved. The important part is they were not blocked from updating the password.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`  
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/auth/reset-password/page.tsx
git commit -m "feat: add reset-password page with local code exchange"
```

---

### Task 7: In-app safety banner + legal footers + trial-ended copy

**Files:**
- Modify: `app/calculator/CalculatorClient.tsx`
- Modify: `app/history/page.tsx`
- Modify: `app/trial-ended/page.tsx`

**Interfaces:**
- Consumes: `SAFETY_REMINDER`, `CONTACT_EMAIL`, `TRIAL_DAYS`

- [ ] **Step 1: Calculator — banner above tabs + footer**

In `CalculatorClient.tsx`, import `Link` is already present; add:

```ts
import { SAFETY_REMINDER } from "@/lib/app-copy";
```

Insert **after** the `<header>` and **before** the tab grid:

```tsx
      <p className="mb-4 rounded-lg border border-[var(--warn)] bg-[var(--warn-bg)] px-3 py-2.5 text-sm font-medium text-[var(--warn-fg)]">
        {SAFETY_REMINDER}
      </p>
```

At the bottom of `<main>` (after slots), add:

```tsx
      <footer className="mt-10 flex gap-4 text-xs font-bold text-[var(--muted)]">
        <Link href="/privacy" className="min-h-11 content-center hover:text-[var(--accent)]">
          Privacy
        </Link>
        <Link href="/terms" className="min-h-11 content-center hover:text-[var(--accent)]">
          Terms
        </Link>
      </footer>
```

- [ ] **Step 2: History — legal footer only (no safety banner)**

At end of history `<main>`:

```tsx
      <footer className="mt-10 flex gap-4 text-xs font-bold text-[var(--muted)]">
        <Link href="/privacy" className="min-h-11 content-center hover:text-[var(--accent)]">
          Privacy
        </Link>
        <Link href="/terms" className="min-h-11 content-center hover:text-[var(--accent)]">
          Terms
        </Link>
      </footer>
```

(`Link` already imported.)

- [ ] **Step 3: Trial-ended — 7-day + $4.99 + contact**

Replace page body copy with:

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CONTACT_EMAIL, TRIAL_DAYS } from "@/lib/app-copy";
import { createClient } from "@/lib/supabase/client";

export default function TrialEndedPage() {
  const router = useRouter();

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-12">
      <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">
        Fuel Dip Calculator
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--text)]">
        Your {TRIAL_DAYS}-day trial has ended
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
        Calculator and history are locked for this account. Paid plans at
        $4.99/month are coming soon. Contact{" "}
        <a
          className="font-bold text-[var(--accent)]"
          href={`mailto:${CONTACT_EMAIL}`}
        >
          {CONTACT_EMAIL}
        </a>{" "}
        if you want to continue after the trial.
      </p>
      <button
        type="button"
        onClick={() => void logout()}
        className="mt-8 min-h-12 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 text-base font-bold text-[var(--text)]"
      >
        Log out
      </button>
      <footer className="mt-10 flex gap-4 text-xs font-bold text-[var(--muted)]">
        <Link href="/privacy" className="min-h-11 content-center hover:text-[var(--accent)]">
          Privacy
        </Link>
        <Link href="/terms" className="min-h-11 content-center hover:text-[var(--accent)]">
          Terms
        </Link>
      </footer>
    </main>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npm run lint && npm run typecheck && npm run test && npm run build`  
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add app/calculator/CalculatorClient.tsx app/history/page.tsx app/trial-ended/page.tsx
git commit -m "feat: add safety banner and trial-ended billing copy"
```

---

### Task 8: Update agent docs (CLAUDE.md)

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update trial / auth / open items**

In `CLAUDE.md`:

- Change references to 14-day trial for **new** accounts to 7-day
- Note email confirmation + `emailRedirectTo` / reset-password page
- Note Privacy/Terms at `/privacy` `/terms`, contact `contact@detours-app.com`
- In “Still open / manual steps”, replace stale magic-link-only notes with ops ordering:

```markdown
- After deploying pre-prod auth redirects: add Supabase Auth redirect allow-list
  entries for `/auth/callback` and `/auth/reset-password`, **then** enable
  Confirm email. Do not enable Confirm email before that deploy.
- Planned $4.99/month billing is copy-only; Stripe still deferred.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: record pre-prod auth, legal, and 7-day trial"
```

---

### Task 9: Manual ops checklist (human — not code)

Do **after** Tasks 1–8 are merged and deployed to production:

1. Confirm production deploy includes `emailRedirectTo` + reset-password page
2. Supabase Dashboard → Authentication → URL Configuration → Redirect URLs:  
   - `https://fuel-dip-calculator.vercel.app/auth/callback`  
   - `https://fuel-dip-calculator.vercel.app/auth/reset-password`
3. **Then** enable Confirm email
4. Optional: Vercel Preview env vars for Supabase URL/anon key
5. Smoke test:
   - New signup → confirmation email → lands on calculator; company trial ≈ 7 days
   - Forgot password → reset page works even if you temporarily set a test company `trial_ends_at` in the past
   - `/privacy` `/terms` load logged out
   - Safety banner on login + calculator
   - Trial-ended shows $4.99 + `contact@detours-app.com`

No commit for this task — checkbox in PR description / handoff notes.

---

## Spec coverage self-review

| Spec requirement | Task |
| --- | --- |
| Email confirmation + existing no-session UX | Task 5 |
| `emailRedirectTo` → `/auth/callback` | Task 5 |
| 7-day trial migration, existing rows untouched | Task 2 |
| Forgot password + reset page | Tasks 5–6 |
| Reset must not use `/auth/callback` trial gate | Task 6 (pinned) |
| Signup Terms/Privacy checkbox | Task 5 |
| `/privacy` `/terms` public | Tasks 3–4 |
| Contact `contact@detours-app.com` | Tasks 1, 4, 7 |
| Safety soft reminder login + calculator | Tasks 5, 7 |
| Trial-ended $4.99 coming soon | Task 7 |
| Ops ordering deploy → allow-list → Confirm email | Task 9 + CLAUDE.md |
| No Stripe / no new tables | Global constraints |

## Placeholder scan

No TBD/TODO left in plan steps. Contact email and safety string are literal.
