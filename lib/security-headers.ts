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
