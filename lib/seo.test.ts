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
