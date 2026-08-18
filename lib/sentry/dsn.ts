/**
 * Public browser DSN — not a secret. Override with NEXT_PUBLIC_SENTRY_DSN.
 * Project: detours-mobile / fuel-dip-calculator
 */
export const SENTRY_DSN =
  process.env.NEXT_PUBLIC_SENTRY_DSN ??
  "https://ee15ec0c90ebc3e19740d9aeb9d8c6fe@o4511662485405696.ingest.us.sentry.io/4511933067493376";

export const SENTRY_ORG = "detours-mobile";
export const SENTRY_PROJECT = "fuel-dip-calculator";
