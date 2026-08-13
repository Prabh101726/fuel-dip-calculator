import { isValidReferralCode, normalizeReferralCode } from "./code";

export const REFERRAL_STORAGE_KEY = "fuel-dip-ref";

export function rememberReferralCodeFromUrl(ref: string | null): void {
  if (typeof window === "undefined") return;
  const code = normalizeReferralCode(ref);
  if (!isValidReferralCode(code)) return;
  try {
    sessionStorage.setItem(REFERRAL_STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
}

export function readStoredReferralCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const code = sessionStorage.getItem(REFERRAL_STORAGE_KEY);
    return isValidReferralCode(code) ? normalizeReferralCode(code) : null;
  } catch {
    return null;
  }
}

export function clearStoredReferralCode(): void {
  try {
    sessionStorage.removeItem(REFERRAL_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
