export const CONTACT_EMAIL = "contact@detours-app.com";

/** Public operator name shown on legal and about pages. */
export const OPERATOR_NAME = "Detours Fleet Operations";

/** Public product name used in titles and share cards. */
export const APP_NAME = "Fuel Dip Calculator";

/** Canonical public origin — used for metadataBase, sitemap, and share URLs. */
export const APP_ORIGIN = "https://fuel-dip-calculator.app";

/** One-line description used as the default meta/OG description. */
export const APP_TAGLINE =
  "Safe discharge sheet for fuel delivery — dip chart volumes, ullage, and reconciliation.";

export const SAFETY_REMINDER =
  "Safety first: always verify the physical tank tag matches the chart number and given site plan Tank charts before delivery.";

export const TRIAL_DAYS = 7;

/** Planned per-driver subscription price in CAD (copy-only until Stripe ships). */
export const MONTHLY_PRICE_CAD = 2.99;

export const MONTHLY_PRICE_LABEL = `$${MONTHLY_PRICE_CAD.toFixed(2)} CAD/month per driver`;

export function authCallbackUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}/auth/callback`;
}

export function resetPasswordUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}/auth/reset-password`;
}
