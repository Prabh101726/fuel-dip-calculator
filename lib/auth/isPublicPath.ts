/**
 * Routes that skip the login redirect. Includes PWA assets: browsers refuse
 * to register a service worker whose script is behind a redirect.
 */
export function isPublicPath(path: string): boolean {
  return (
    path === "/login" ||
    path.startsWith("/auth/") ||
    path === "/trial-ended" ||
    path === "/privacy" ||
    path === "/terms" ||
    path === "/about" ||
    path === "/guide" ||
    path === "/refer" ||
    path === "/api/stripe/webhook" ||
    path === "/sw.js" ||
    /^\/swe-worker-[^/]+\.js$/.test(path) ||
    path === "/manifest.webmanifest" ||
    path === "/~offline" ||
    path === "/robots.txt" ||
    path === "/sitemap.xml" ||
    path === "/opengraph-image"
  );
}
