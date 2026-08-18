import { describe, expect, it } from "vitest";
import { isPublicPath } from "./isPublicPath";

describe("isPublicPath", () => {
  it("allows login, legal, and auth callback routes", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
    expect(isPublicPath("/privacy")).toBe(true);
    expect(isPublicPath("/terms")).toBe(true);
    expect(isPublicPath("/about")).toBe(true);
    expect(isPublicPath("/guide")).toBe(true);
    expect(isPublicPath("/refer")).toBe(true);
    expect(isPublicPath("/trial-ended")).toBe(true);
    expect(isPublicPath("/api/stripe/webhook")).toBe(true);
  });

  it("allows PWA assets that must never 307 to /login", () => {
    expect(isPublicPath("/sw.js")).toBe(true);
    expect(isPublicPath("/swe-worker-abc123.js")).toBe(true);
    expect(isPublicPath("/manifest.webmanifest")).toBe(true);
    expect(isPublicPath("/~offline")).toBe(true);
  });

  it("does not treat calculator or feedback as public", () => {
    expect(isPublicPath("/calculator")).toBe(false);
    expect(isPublicPath("/history")).toBe(false);
    expect(isPublicPath("/feedback")).toBe(false);
    expect(isPublicPath("/subscribe")).toBe(false);
    expect(isPublicPath("/swe-worker-abc/evil.js")).toBe(false);
    expect(isPublicPath("/not-sw.js")).toBe(false);
  });

  it("allows SEO and share-image routes", () => {
    expect(isPublicPath("/robots.txt")).toBe(true);
    expect(isPublicPath("/sitemap.xml")).toBe(true);
    expect(isPublicPath("/opengraph-image")).toBe(true);
  });
});
