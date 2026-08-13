export const REFERRAL_CODE_PREFIX = "FD";
export const REFERRAL_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeReferralCode(raw: string | null | undefined): string {
  return (raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidReferralCode(raw: string | null | undefined): boolean {
  const code = normalizeReferralCode(raw);
  if (code.length !== 6 || !code.startsWith(REFERRAL_CODE_PREFIX)) return false;
  const rest = code.slice(2);
  return [...rest].every((ch) => REFERRAL_ALPHABET.includes(ch));
}

/** `nextInt` must return >= 0. Used with `Math.random` or a test stub. */
export function generateReferralCode(nextInt: () => number): string {
  let rest = "";
  for (let i = 0; i < 4; i++) {
    const n = Math.abs(Math.floor(nextInt())) % REFERRAL_ALPHABET.length;
    rest += REFERRAL_ALPHABET[n];
  }
  return `${REFERRAL_CODE_PREFIX}${rest}`;
}
