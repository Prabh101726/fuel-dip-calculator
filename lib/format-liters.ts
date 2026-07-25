/** Round and format liters for display (en-CA grouping). */
export function formatLiters(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Math.round(n).toLocaleString("en-CA")} L`;
}

/**
 * Like formatLiters, but prefixes "+" for positive values so gains read
 * the same way losses already show a leading "-".
 */
export function formatSignedLiters(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  const rounded = Math.round(n);
  if (rounded > 0) return `+${rounded.toLocaleString("en-CA")} L`;
  return `${rounded.toLocaleString("en-CA")} L`;
}
