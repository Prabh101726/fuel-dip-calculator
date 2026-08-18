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
