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

/**
 * Allowlist for post-login navigation (?next= on /login), including early subscribe.
 */
export function safePostAuthNext(
  next: string | null | undefined,
): "/calculator" | "/history" | "/subscribe" | "/feedback" {
  if (
    next === "/calculator" ||
    next === "/history" ||
    next === "/subscribe" ||
    next === "/feedback"
  ) {
    return next;
  }
  return "/calculator";
}

/**
 * Allowlist for Stripe Checkout cancel_url path (early subscribe vs trial-ended).
 */
export function safeCheckoutCancelPath(
  path: string | null | undefined,
): "/subscribe" | "/trial-ended" {
  if (path === "/subscribe" || path === "/trial-ended") {
    return path;
  }
  return "/trial-ended";
}
