# Pre-Production Readiness — Design Spec

Date: 2026-07-26  
Product: Fuel Dip Calculator (SRV Freight Inc)  
Status: Approved for implementation planning (Approach 2)

## Purpose

The calculator core (password auth, **14-day** trial provisioning, 4-tab
multi-tank flow, history) is working in production. This pass makes the live
app safer for real drivers and soft launch: harden open signup with email
confirmation, shorten **new** trials to **7 days**, ship legal pages, surface
safety reminders, and document the planned $4.99/month subscription without
building Stripe yet.

## Decisions (locked)

| Topic | Choice |
| --- | --- |
| Signup model | Keep open signup |
| Trial hardening | Email confirmation required before calculator use |
| Trial length | **7 days** for newly provisioned companies |
| Existing trials | Leave current `trial_ends_at` unchanged |
| Legal | Plain-language Privacy + Terms drafts under SRV Freight Inc |
| Safety messaging | Soft reminder on login + calculator (no checkbox / no save gate) |
| Billing this pass | Spec + copy only; planned **$4.99/month**; no Stripe |

## Out of scope

- Stripe Checkout, webhooks, subscription schema columns
- Invite-only, access codes, disposable-email blocking
- Signature capture (image), history filtering, offline/PWA
- Resolving the 12 flagged tanks in `supabase/seed/review_needed.json`
- Error monitoring (e.g. Sentry)
- Multi-company admin onboarding / sites registry

## Architecture overview

```
Signup (open)
  → email confirmation (Supabase Auth)
  → /auth/callback
  → ensure_trial_driver()  [7-day trial for new companies]
  → /calculator

Login / middleware
  → session required for /calculator, /history
  → trial_ends_at gate → /trial-ended

Public routes
  → /login, /auth/*, /privacy, /terms, /trial-ended
```

No new product tables. One migration updates trial default/interval only.
Auth confirmation and password reset are Supabase Auth features wired through
existing `/auth/callback` plus a small reset-password page.

---

## 1. Auth + 7-day trial

### 1.1 Email confirmation

**Code already in place (do not rebuild):**

- `LoginForm` already handles `signUp` with no session and shows a confirm-email
  message — enabling Confirm email will use that path, not strand users.
- `/auth/callback` already exchanges the code, calls `ensure_trial_driver()`,
  and gates on trial status — that is the confirmation-link landing route.
- Middleware `path.startsWith("/auth/")` already makes `/auth/reset-password`
  public once added; only `/privacy` and `/terms` need new public allow-list
  entries.

**Must implement in this pass:**

- `signUp` **must** pass `options.emailRedirectTo` pointing at the app’s
  `/auth/callback` absolute URL (e.g.
  `${window.location.origin}/auth/callback` in the browser, or the production
  origin in server contexts). Without this, confirmation links fall back to the
  Supabase Site URL (local-dev in `config.toml`) and break production signup.
- Same pattern for `resetPasswordForEmail` → `redirectTo` on
  `/auth/reset-password`.
- Keep the existing no-session signup UX message (clarify “check your email”
  copy if needed).
- Unconfirmed users have no session → middleware already blocks `/calculator`
  and `/history`.

**Dashboard (after deploy — see §5 ordering):** enable Confirm email in the
live Supabase project.

### 1.2 Trial length migration

Change new-company trial from 14 days to 7 days:

- `companies.trial_ends_at` column default: `now() + interval '7 days'`
- `ensure_trial_driver()` insert: `now() + interval '7 days'`
- Do **not** bulk-update existing rows
- Update UI copy that says “14-day” → “7-day” (trial-ended page, any signup hints)

### 1.3 Forgot password

- On `/login`: “Forgot password?” control
- Sends `supabase.auth.resetPasswordForEmail` with redirect to a dedicated
  page (e.g. `/auth/reset-password`)
- Reset page: authenticated recovery session → `updateUser({ password })` →
  sign-in / calculator
- Document redirect URL in Supabase Auth allow-list (manual ops)

### 1.4 Signup legal checkbox

- Create-account mode only: required checkbox  
  “I agree to the Terms of Use and Privacy Policy”  
  with links to `/terms` and `/privacy`
- Block submit until checked

---

## 2. Privacy Policy + Terms of Use

### 2.1 Routes

- `/privacy` — public Server Component (or static page)
- `/terms` — public Server Component (or static page)
- Middleware: add both to the public allow-list (same class as `/login`)

### 2.2 Content (plain-language draft)

Operator: **SRV Freight Inc**  
Contact email: **contact@detours-app.com** (same SRV / Detours ops inbox —
shared across products). Same address on Privacy, Terms, and trial-ended.

**Privacy** covers at minimum:

- Account data: email, auth identifiers
- App data: company/trial metadata, saved `dip_calculations`, typed signature name
- Shared reference data: `tank_types` / dip charts (not personal)
- Purpose of processing: provide the calculator and history
- No selling of personal data
- Retention: while account is active / as needed to operate the service
- Contact for privacy requests

**Terms** cover at minimum:

- Service description (driver tool for dip → volume / safe discharge math)
- Safety / responsibility: drivers must verify tank tags match the selected
  chart; the app assists and does not replace site procedures or professional
  judgment
- Trial (7 days) and planned paid subscription ($4.99/month) — payment not
  live yet
- Acceptable use
- Limitation of liability appropriate for a soft-launch draft
- Governing context: Canada / Ontario oriented unless counsel later specifies
  otherwise

These are practical soft-launch drafts, not lawyer-reviewed counsel. Routes and
structure stay stable so legal can replace copy later without rewiring.

### 2.3 Links

- Login (both modes): links to Privacy and Terms
- Signup checkbox links into those pages
- Small footer links on calculator, history, and trial-ended

---

## 3. Safety messaging

### 3.1 Copy (single shared constant)

Exact string (or equivalent approved tweak at implementation):

> Safety first: always verify the physical tank tag matches the chart number
> and given site plan Tank charts before delivery.

### 3.2 Placement

- **Login:** visible callout near the form (sign-in and create-account)
- **Calculator shell:** compact banner above the 4 tank tabs (visible for all slots)
- **History:** none

### 3.3 Behavior

- Soft reminder only — no acknowledgment checkbox, no per-save confirmation
- Do not claim the app replaces the Safe Discharge Sheet or site SOPs

---

## 4. Billing messaging (no Stripe)

### 4.1 Planned offer

- **$4.99 per month per account** (v1 = one auto-provisioned driver per signup;
  revisit if multi-driver companies become real)
- Not collectable in this pass

### 4.2 Trial-ended page

Update copy to:

- State the **7-day** trial has ended
- Calculator and history are locked
- Paid plans at **$4.99/month** are coming soon
- Contact email to continue / request access
- Keep log out

### 4.3 Legal cross-reference

Terms may mention the planned subscription; no payment UI or schema changes.

---

## 5. Manual ops checklist (not code)

**Ordering matters.** Do not enable Confirm email until the deployed app sends
`emailRedirectTo` / `redirectTo` correctly and the Auth redirect allow-list
includes those URLs — otherwise new signups get confirmation links that land on
the wrong Site URL.

Complete in this order before calling soft launch “ready”:

1. Contact email locked: `contact@detours-app.com` (see §2.2)
2. Deploy the code that sets `emailRedirectTo` on signup and `redirectTo` on
   password reset
3. Supabase Auth → URL Configuration: allow  
   `https://fuel-dip-calculator.vercel.app/auth/callback`  
   and  
   `https://fuel-dip-calculator.vercel.app/auth/reset-password`
4. **Only then** Supabase Auth → enable **Confirm email**
5. Optional: set Vercel **Preview** env vars  
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) if using PR previews

Do **not** push full local `supabase/config.toml` via `supabase config push`
(risk of clobbering dashboard auth settings). Prefer dashboard for Auth URL /
email confirm toggles.

---

## Error handling

| Case | Behavior |
| --- | --- |
| Signup, confirm email on, no session | Stay on login; success message to check email |
| Confirm / reset link expired | Login shows clear expired-link message; use password / request new link |
| Reset email send failure | Inline error on login |
| Trial expired | Middleware → `/trial-ended` |
| Unauthenticated deep link | → `/login` |

---

## Testing

- Unit tests: none required for copy-only UI unless extracting pure helpers
- Manual:
  - Signup → confirm email → lands in calculator with ~7-day trial
  - Unconfirmed account cannot access calculator
  - Forgot password → reset → sign in
  - Signup blocked without Terms/Privacy checkbox
  - `/privacy` and `/terms` load logged out
  - Safety banner on login + calculator
  - Existing company with old 14-day `trial_ends_at` unchanged after migration
- CI: `npm run lint && npm run typecheck && npm run test && npm run build`

## Success criteria

- Open signup remains, but calculator requires confirmed email
- New companies get a 7-day trial; existing trials untouched
- Privacy + Terms live and linked; signup requires acceptance
- Safety reminder visible on login and calculator
- Trial-ended communicates 7-day trial + upcoming $4.99/month + contact
- Ops checklist documented; contact email is `contact@detours-app.com`
