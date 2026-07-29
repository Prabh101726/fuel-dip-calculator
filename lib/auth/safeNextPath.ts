/**
 * Allowlist for /auth/callback ?next= to prevent open redirects
 * (e.g. next=@evil.com → https://app@evil.com).
 */
export function safeAuthCallbackNext(
  next: string | null | undefined,
): "/calculator" | "/history" {
  if (next === "/calculator" || next === "/history") {
    return next;
  }
  return "/calculator";
}
