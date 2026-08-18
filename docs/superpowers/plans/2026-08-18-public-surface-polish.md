# Public Surface Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the logged-out public surface presentable to strangers — OG/share unfurls for referral links, per-page titles, baseline security headers, robots.txt + sitemap.xml — without touching the app behind login.

**Architecture:** All copy/URL constants live in `lib/app-copy.ts`; new pure helpers (`lib/page-metadata.ts`, `lib/security-headers.ts`, `lib/seo.ts`) are unit-tested in vitest and consumed by thin Next.js wiring (`next.config.ts` `headers()`, App Router `metadata` exports, `app/robots.ts`, `app/sitemap.ts`, `app/opengraph-image.tsx`). New public URLs are added to `isPublicPath()` so middleware never 307s them (same class of bug as Sentry FUEL-DIP-CALCULATOR-5).

**Tech Stack:** Next.js 16.2.11 App Router (`Metadata`, `MetadataRoute`, `next/og` `ImageResponse`), vitest. **No new dependencies.**

**Spec:** No separate spec doc — requirements come from the Aug 18 public-surface audit (this session, follow-on to `docs/audit-2026-08-18-production-readiness.md`). Requirements, verbatim:
1. Referral/share links (`/login?ref=FDXXXX`, `/refer`) must unfurl in iMessage/WhatsApp with a real title, description, and image.
2. Every public page gets its own `<title>` + meta description (currently all six share one generic pair).
3. Baseline security headers on every response: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`. **CSP is explicitly out of scope** (Sentry replay + Next inline scripts make it a project of its own — follow-up).
4. `robots.txt` and `sitemap.xml` must serve 200 (today they 307 to `/login`), allowing the six public pages and disallowing everything auth-gated.
5. **Out of scope:** a marketing landing page at `/` (root keeps its 307 → `/login`), CSP, any change to auth-gated pages, SW/precache changes.

## Global Constraints

- **No new npm dependencies.** Everything uses what Next 16 ships (`next/og` is built in).
- **Never 307 `/sw.js`, `/swe-worker-*.js`, `/manifest.webmanifest`, or `/~offline` to `/login`** (CLAUDE.md constraint, Sentry FUEL-DIP-CALCULATOR-5). Do not edit the `middleware.ts` `matcher` regex in this plan — all new public URLs go through `isPublicPath()` only.
- **Do not precache anything new.** `additionalPrecacheEntries` stays exactly `[{ url: "/~offline", revision }]`. Do not touch `app/sw.ts`.
- **Do not add HSTS** — Vercel already sends `strict-transport-security`; a second copy is noise.
- Copy values (price, trial length, operator, tagline) come from `lib/app-copy.ts` constants — never hardcode `$2.99` / `7` / the tagline string in a page or route.
- Follow existing commit style (`feat:` / `fix:` / `docs:`, imperative, co-author trailer as configured).
- Run `npx vitest run` and `npx tsc --noEmit` before every commit; both must be green.

## File Structure

- Modify `lib/app-copy.ts` — add `APP_NAME`, `APP_ORIGIN`, `APP_TAGLINE` (single source for name/origin/tagline).
- Create `lib/page-metadata.ts` (+ test) — `pageMetadata(title, description)` helper for per-page `metadata` exports.
- Modify `lib/auth/isPublicPath.ts` (+ test) — add `/robots.txt`, `/sitemap.xml`, `/opengraph-image`.
- Create `lib/security-headers.ts` (+ test) — exported header list; consumed by `next.config.ts`.
- Modify `next.config.ts` — `headers()` on the inner `nextConfig`.
- Modify `app/layout.tsx` — `metadataBase`, title template, `openGraph` + `twitter` defaults.
- Create `app/opengraph-image.tsx` — 1200×630 `ImageResponse`, applies to all routes automatically (App Router file convention).
- Create `lib/seo.ts` (+ test) — pure `robotsConfig()` / `sitemapEntries()`; thin wrappers `app/robots.ts`, `app/sitemap.ts`.
- Modify the six public pages (`app/{login,about,guide,privacy,terms,refer}/page.tsx`) — `metadata` exports only; **zero JSX changes**.

---

### Task 1: Share/SEO constants + `pageMetadata` helper

**Files:**
- Modify: `lib/app-copy.ts`
- Create: `lib/page-metadata.ts`
- Test: `lib/page-metadata.test.ts`

**Interfaces:**
- Produces: `APP_NAME: string`, `APP_ORIGIN: string`, `APP_TAGLINE: string` (from `lib/app-copy.ts`); `pageMetadata(title: string, description: string): Metadata` (from `lib/page-metadata.ts`). Tasks 4–7 consume all of these.

- [ ] **Step 1: Write the failing test**

```ts
// lib/page-metadata.test.ts
import { describe, expect, it } from "vitest";
import { APP_NAME, APP_ORIGIN, APP_TAGLINE } from "@/lib/app-copy";
import { pageMetadata } from "@/lib/page-metadata";

describe("app-copy share constants", () => {
  it("pins the public origin and name", () => {
    expect(APP_ORIGIN).toBe("https://fuel-dip-calculator.app");
    expect(APP_NAME).toBe("Fuel Dip Calculator");
    expect(APP_TAGLINE).toBe(
      "Safe discharge sheet for fuel delivery — dip chart volumes, ullage, and reconciliation.",
    );
  });
});

describe("pageMetadata", () => {
  it("returns title and description for a page", () => {
    const meta = pageMetadata("User guide", "Quick steps.");
    expect(meta).toEqual({ title: "User guide", description: "Quick steps." });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/page-metadata.test.ts`
Expected: FAIL — `APP_ORIGIN` / `pageMetadata` not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `lib/app-copy.ts` (below `OPERATOR_NAME`):

```ts
/** Public product name used in titles and share cards. */
export const APP_NAME = "Fuel Dip Calculator";

/** Canonical public origin — used for metadataBase, sitemap, and share URLs. */
export const APP_ORIGIN = "https://fuel-dip-calculator.app";

/** One-line description used as the default meta/OG description. */
export const APP_TAGLINE =
  "Safe discharge sheet for fuel delivery — dip chart volumes, ullage, and reconciliation.";
```

Create `lib/page-metadata.ts`:

```ts
import type { Metadata } from "next";

/**
 * Metadata for a public page. Title flows through the root layout's
 * `%s — Fuel Dip Calculator` template; OG/twitter tags inherit from the
 * root layout defaults, and the OG image comes from app/opengraph-image.tsx.
 */
export function pageMetadata(title: string, description: string): Metadata {
  return { title, description };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/page-metadata.test.ts`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add lib/app-copy.ts lib/page-metadata.ts lib/page-metadata.test.ts
git commit -m "feat: add share constants and pageMetadata helper"
```

---

### Task 2: Public paths for robots, sitemap, and the OG image

**Files:**
- Modify: `lib/auth/isPublicPath.ts`
- Test: `lib/auth/isPublicPath.test.ts` (append)

**Interfaces:**
- Consumes: existing `isPublicPath(path: string): boolean`.
- Produces: `isPublicPath` returns `true` for `/robots.txt`, `/sitemap.xml`, `/opengraph-image`. Tasks 5 and 7 rely on this so their routes serve 200 instead of 307 → `/login`.

- [ ] **Step 1: Write the failing tests**

Append to the existing describe block in `lib/auth/isPublicPath.test.ts`:

```ts
it("allows SEO and share-image routes", () => {
  expect(isPublicPath("/robots.txt")).toBe(true);
  expect(isPublicPath("/sitemap.xml")).toBe(true);
  expect(isPublicPath("/opengraph-image")).toBe(true);
});

it("still gates the app routes", () => {
  expect(isPublicPath("/calculator")).toBe(false);
  expect(isPublicPath("/history")).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/auth/isPublicPath.test.ts`
Expected: FAIL — the three new paths return `false`.

- [ ] **Step 3: Implement**

In `lib/auth/isPublicPath.ts`, add three lines to the return expression, after `path === "/~offline"`:

```ts
    path === "/~offline" ||
    path === "/robots.txt" ||
    path === "/sitemap.xml" ||
    path === "/opengraph-image"
```

(Next serves the generated OG image at exactly `/opengraph-image`; the cache-buster is a query string, so an exact path match is correct.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/auth/isPublicPath.test.ts`
Expected: PASS, including all pre-existing cases.

- [ ] **Step 5: Commit**

```bash
git add lib/auth/isPublicPath.ts lib/auth/isPublicPath.test.ts
git commit -m "feat: open robots, sitemap, and og-image paths in middleware"
```

---

### Task 3: Baseline security headers

**Files:**
- Create: `lib/security-headers.ts`
- Modify: `next.config.ts`
- Test: `lib/security-headers.test.ts`

**Interfaces:**
- Produces: `SECURITY_HEADERS: { key: string; value: string }[]` consumed only by `next.config.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/security-headers.test.ts
import { describe, expect, it } from "vitest";
import { SECURITY_HEADERS } from "@/lib/security-headers";

describe("SECURITY_HEADERS", () => {
  it("sets the four baseline headers", () => {
    const byKey = Object.fromEntries(
      SECURITY_HEADERS.map((h) => [h.key, h.value]),
    );
    expect(byKey["X-Content-Type-Options"]).toBe("nosniff");
    expect(byKey["X-Frame-Options"]).toBe("DENY");
    expect(byKey["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(byKey["Permissions-Policy"]).toBe(
      "camera=(), microphone=(), geolocation=()",
    );
    expect(SECURITY_HEADERS).toHaveLength(4);
  });

  it("does not duplicate Vercel's HSTS header", () => {
    expect(
      SECURITY_HEADERS.some(
        (h) => h.key.toLowerCase() === "strict-transport-security",
      ),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/security-headers.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

Create `lib/security-headers.ts`:

```ts
/**
 * Baseline security headers for every response. HSTS is intentionally
 * absent (Vercel already sends it). CSP is a deliberate follow-up —
 * Sentry replay + Next inline scripts need a nonce strategy first.
 * The app uses no camera/microphone/geolocation APIs (signature capture
 * is deferred), so Permissions-Policy denies all three.
 */
export const SECURITY_HEADERS: { key: string; value: string }[] = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];
```

In `next.config.ts`, add the import and extend the **inner** `nextConfig` object (the Serwist/Sentry wrappers pass it through unchanged):

```ts
import { SECURITY_HEADERS } from "./lib/security-headers";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: packageVersion,
  },
  async headers() {
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
  },
};
```

- [ ] **Step 4: Run test + typecheck**

Run: `npx vitest run lib/security-headers.test.ts && npx tsc --noEmit`
Expected: PASS / clean.

- [ ] **Step 5: Verify headers actually serve**

Run: `npm run build && npm start &` then `curl -sI http://localhost:3000/login | grep -iE "x-content-type|x-frame|referrer-policy|permissions-policy"`
Expected: all four headers present. Kill the server afterwards.

- [ ] **Step 6: Commit**

```bash
git add lib/security-headers.ts lib/security-headers.test.ts next.config.ts
git commit -m "feat: add baseline security headers"
```

---

### Task 4: Root layout share defaults

**Files:**
- Modify: `app/layout.tsx:15-28` (the `metadata` export only)

**Interfaces:**
- Consumes: `APP_NAME`, `APP_ORIGIN`, `APP_TAGLINE` from Task 1.
- Produces: title template `%s — Fuel Dip Calculator` that every Task 6 page title flows through; `metadataBase` so the OG image URL is absolute in unfurls.

- [ ] **Step 1: Replace the `metadata` export**

`app/layout.tsx` — no unit test (the file imports `next/font/google`, which vitest can't load); Step 2 verifies via rendered HTML. Replace the existing `export const metadata` block with:

```tsx
import { APP_NAME, APP_ORIGIN, APP_TAGLINE } from "@/lib/app-copy";

export const metadata: Metadata = {
  metadataBase: new URL(APP_ORIGIN),
  title: {
    default: APP_NAME,
    template: `%s — ${APP_NAME}`,
  },
  description: APP_TAGLINE,
  applicationName: APP_NAME,
  openGraph: {
    siteName: APP_NAME,
    type: "website",
    title: APP_NAME,
    description: APP_TAGLINE,
  },
  twitter: {
    card: "summary_large_image",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Fuel Dip",
  },
  formatDetection: {
    telephone: false,
  },
};
```

(Keep the existing `viewport` export and everything else untouched.)

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run build && npm start &` then
`curl -s http://localhost:3000/about | grep -oE '<meta property="og:[^>]+>' | head`
Expected: `og:site_name`, `og:type`, `og:title`, `og:description` present. Kill the server.

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: add OG/twitter defaults and title template to root layout"
```

---

### Task 5: OG share image

**Files:**
- Create: `app/opengraph-image.tsx`

**Interfaces:**
- Consumes: `APP_NAME`, `APP_TAGLINE`, `MONTHLY_PRICE_LABEL`, `TRIAL_DAYS` from `lib/app-copy.ts`; public path opened in Task 2.
- Produces: `/opengraph-image` (1200×630 PNG) that Next auto-injects as `og:image` + `twitter:image` on **every** route — no per-page wiring needed.

- [ ] **Step 1: Create the image route**

```tsx
// app/opengraph-image.tsx
import { ImageResponse } from "next/og";
import {
  APP_NAME,
  APP_TAGLINE,
  MONTHLY_PRICE_LABEL,
  TRIAL_DAYS,
} from "@/lib/app-copy";

export const alt = APP_NAME;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          backgroundColor: "#12141a",
          color: "#f4f5f7",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 28, letterSpacing: 4, textTransform: "uppercase", color: "#8b93a3" }}>
          Detours Fleet Operations
        </div>
        <div style={{ fontSize: 76, fontWeight: 700, marginTop: 16 }}>
          {APP_NAME}
        </div>
        <div style={{ fontSize: 34, marginTop: 24, color: "#c2c8d4", maxWidth: 900 }}>
          {APP_TAGLINE}
        </div>
        <div style={{ fontSize: 30, marginTop: 48, color: "#4ade80" }}>
          {TRIAL_DAYS}-day free trial · {MONTHLY_PRICE_LABEL}
        </div>
      </div>
    ),
    size,
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run build && npm start &` then:
- `curl -s -o /tmp/og.png -w "%{http_code} %{content_type}\n" http://localhost:3000/opengraph-image` → expect `200 image/png`.
- `curl -s http://localhost:3000/login | grep -o 'og:image' | head -1` → expect a match.
- Open `/tmp/og.png` and eyeball it (no clipped text).
Kill the server.

- [ ] **Step 3: Commit**

```bash
git add app/opengraph-image.tsx
git commit -m "feat: add OG share image"
```

---

### Task 6: Per-page titles and descriptions

**Files:**
- Modify: `app/login/page.tsx`, `app/about/page.tsx`, `app/guide/page.tsx`, `app/privacy/page.tsx`, `app/terms/page.tsx`, `app/refer/page.tsx` — **`metadata` exports only, zero JSX changes.** All six are Server Components (verified), so `export const metadata` is legal.

**Interfaces:**
- Consumes: `pageMetadata` (Task 1), title template (Task 4).

- [ ] **Step 1: Add metadata exports**

`/login` is the share target for referral links, so it keeps the brand as an **absolute** title (not "Sign in — …") with a hook description. Add to `app/login/page.tsx`:

```tsx
import type { Metadata } from "next";
import {
  APP_NAME,
  APP_TAGLINE,
  MONTHLY_PRICE_LABEL,
  TRIAL_DAYS,
} from "@/lib/app-copy";

export const metadata: Metadata = {
  title: { absolute: APP_NAME },
  description: `${APP_TAGLINE} ${TRIAL_DAYS}-day free trial, then ${MONTHLY_PRICE_LABEL}.`,
};
```

The other five use the helper — add near the top of each file:

```tsx
// app/about/page.tsx
import { pageMetadata } from "@/lib/page-metadata";
export const metadata = pageMetadata(
  "About",
  "What Fuel Dip Calculator is, who operates it, and what it costs.",
);
```

```tsx
// app/guide/page.tsx
import { pageMetadata } from "@/lib/page-metadata";
export const metadata = pageMetadata(
  "User guide",
  "Quick steps for a safe discharge calculation, from sign-in to reconciliation.",
);
```

```tsx
// app/privacy/page.tsx
import { pageMetadata } from "@/lib/page-metadata";
export const metadata = pageMetadata(
  "Privacy policy",
  "What Fuel Dip Calculator collects, stores, and never stores.",
);
```

```tsx
// app/terms/page.tsx
import { pageMetadata } from "@/lib/page-metadata";
export const metadata = pageMetadata(
  "Terms of service",
  "Terms for using Fuel Dip Calculator, operated by Detours Fleet Operations.",
);
```

```tsx
// app/refer/page.tsx
import { pageMetadata } from "@/lib/page-metadata";
export const metadata = pageMetadata(
  "Refer a driver",
  "Share your link — you get 14 extra days when a friend subscribes.",
);
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run build && npm start &` then:
- `curl -s http://localhost:3000/guide | grep -o '<title>[^<]*</title>'` → expect `<title>User guide — Fuel Dip Calculator</title>`.
- `curl -s http://localhost:3000/login | grep -o '<title>[^<]*</title>'` → expect `<title>Fuel Dip Calculator</title>` (absolute, no template suffix).
Kill the server.

- [ ] **Step 3: Commit**

```bash
git add app/login/page.tsx app/about/page.tsx app/guide/page.tsx app/privacy/page.tsx app/terms/page.tsx app/refer/page.tsx
git commit -m "feat: per-page titles and descriptions for public pages"
```

---

### Task 7: robots.txt + sitemap.xml

**Files:**
- Create: `lib/seo.ts`
- Create: `app/robots.ts`, `app/sitemap.ts`
- Test: `lib/seo.test.ts`

**Interfaces:**
- Consumes: `APP_ORIGIN` (Task 1); public paths opened in Task 2.
- Produces: `robotsConfig(): MetadataRoute.Robots`, `sitemapEntries(): MetadataRoute.Sitemap` — consumed only by the two thin app routes.

- [ ] **Step 1: Write the failing test**

```ts
// lib/seo.test.ts
import { describe, expect, it } from "vitest";
import { APP_ORIGIN } from "@/lib/app-copy";
import { robotsConfig, sitemapEntries } from "@/lib/seo";

const PUBLIC_PATHS = ["/login", "/about", "/guide", "/privacy", "/terms", "/refer"];

describe("robotsConfig", () => {
  it("allows public pages and disallows the app", () => {
    const rules = robotsConfig().rules;
    expect(rules).toEqual({
      userAgent: "*",
      allow: PUBLIC_PATHS,
      disallow: ["/calculator", "/history", "/feedback", "/subscribe", "/trial-ended", "/api/"],
    });
  });

  it("points at the sitemap on the canonical origin", () => {
    expect(robotsConfig().sitemap).toBe(`${APP_ORIGIN}/sitemap.xml`);
  });
});

describe("sitemapEntries", () => {
  it("lists exactly the six public pages on the canonical origin", () => {
    expect(sitemapEntries().map((e) => e.url)).toEqual(
      PUBLIC_PATHS.map((p) => `${APP_ORIGIN}${p}`),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/seo.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

Create `lib/seo.ts`:

```ts
import type { MetadataRoute } from "next";
import { APP_ORIGIN } from "@/lib/app-copy";

const PUBLIC_PATHS = ["/login", "/about", "/guide", "/privacy", "/terms", "/refer"];

export function robotsConfig(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: PUBLIC_PATHS,
      disallow: ["/calculator", "/history", "/feedback", "/subscribe", "/trial-ended", "/api/"],
    },
    sitemap: `${APP_ORIGIN}/sitemap.xml`,
  };
}

export function sitemapEntries(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.map((path) => ({
    url: `${APP_ORIGIN}${path}`,
    changeFrequency: "monthly",
  }));
}
```

Create `app/robots.ts`:

```ts
import type { MetadataRoute } from "next";
import { robotsConfig } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return robotsConfig();
}
```

Create `app/sitemap.ts`:

```ts
import type { MetadataRoute } from "next";
import { sitemapEntries } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/seo.test.ts && npx tsc --noEmit`
Expected: PASS / clean.

- [ ] **Step 5: Verify routes serve without redirect**

Run: `npm run build && npm start &` then
`curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3000/robots.txt` and the same for `/sitemap.xml`.
Expected: `200` with empty redirect for both. Kill the server.

- [ ] **Step 6: Commit**

```bash
git add lib/seo.ts lib/seo.test.ts app/robots.ts app/sitemap.ts
git commit -m "feat: serve robots.txt and sitemap.xml"
```

---

### Task 8: Full verification + docs

**Files:**
- Modify: `CLAUDE.md` (status + constraints)

- [ ] **Step 1: Full local gate**

Run: `npx vitest run && npx tsc --noEmit && npm run lint && npm run build`
Expected: all green. Note the new total test count.

- [ ] **Step 2: Full local smoke (one server run)**

`npm start &`, then verify and record each:
- `/robots.txt`, `/sitemap.xml`, `/opengraph-image` → 200, no redirect.
- `/sw.js`, `/manifest.webmanifest`, `/~offline` → **still** 200, no redirect (regression guard for FUEL-DIP-CALCULATOR-5).
- `/calculator` → still 307 → `/login` (headers task must not have loosened gating).
- `/login` response includes `og:image`, `og:site_name`, and the four security headers.
Kill the server.

- [ ] **Step 3: Update CLAUDE.md**

- In the **Status** paragraph, append: public-surface polish (OG share image + per-page metadata, baseline security headers, robots/sitemap) with today's date.
- Strike "security headers" from the deferred list; replace with: "CSP — deferred (needs a nonce strategy compatible with Sentry replay; the four baseline headers shipped, see `lib/security-headers.ts`)."
- Add one load-bearing line: "Public-URL rule: any new publicly fetchable route (metadata files, share images) must be added to `isPublicPath()` — middleware 307s break crawlers, unfurl bots, and SW registration alike."

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: record public-surface polish in CLAUDE.md"
```

- [ ] **Step 5: After deploy (production spot-check)**

Once merged and Vercel deploys `main`:
- `curl -sI https://fuel-dip-calculator.app/login | grep -iE "x-frame|x-content|referrer|permissions"` → four headers.
- `curl -s -o /dev/null -w "%{http_code}\n" https://fuel-dip-calculator.app/robots.txt` → 200.
- Paste `https://fuel-dip-calculator.app/refer` into iMessage/WhatsApp → card shows image + title.
