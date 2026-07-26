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
