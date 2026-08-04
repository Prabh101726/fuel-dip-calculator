/** Strip spaces, dashes, parens before normalize. */
export function cleanPhoneDigits(raw: string): string {
  return String(raw || "").replace(/[\s\-().]/g, "");
}

/**
 * Normalize to E.164. Bare 10-digit NANP → +1…; 11-digit starting with 1 → +1….
 * Does not validate country — use {@link toNanpE164} for login.
 */
export function normalizePhone(raw: string): string {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) {
    return `+${trimmed.slice(1).replace(/\D/g, "")}`;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  return trimmed;
}

/**
 * Canada/US login only: exactly +1 and 10 national digits.
 * Returns null when the input is not a valid NANP mobile/local form.
 */
export function toNanpE164(raw: string): string | null {
  const e164 = normalizePhone(cleanPhoneDigits(raw));
  if (!/^\+1\d{10}$/.test(e164)) return null;
  const nxx = e164.slice(2, 5);
  // Area code cannot start with 0 or 1
  if (nxx.startsWith("0") || nxx.startsWith("1")) return null;
  return e164;
}

/** Display +1XXXXXXXXXX as (XXX) XXX-XXXX. */
export function formatNanpDisplay(e164: string): string {
  const n = normalizePhone(cleanPhoneDigits(e164));
  const d = n.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) {
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10) {
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return e164 || "";
}
