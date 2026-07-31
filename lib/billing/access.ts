/** Stripe subscription statuses that keep calculator access open. */
export const ACTIVE_SUBSCRIPTION_STATUSES = [
  "active",
  "trialing",
  "past_due",
] as const;

export function isActiveSubscriptionStatus(
  status: string | null | undefined,
): boolean {
  if (!status) return false;
  return (ACTIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(status);
}

/**
 * Driver access: Postgres trial still open, or this driver's Stripe status
 * is active / trialing / past_due. Null trialEndsAt = active (matches RLS).
 */
export function isAccessActive(input: {
  trialEndsAt: string | null | undefined;
  subscriptionStatus: string | null | undefined;
  now?: Date;
}): boolean {
  const nowMs = (input.now ?? new Date()).getTime();

  // Null / empty trial_ends_at = active (matches my_trial_active)
  if (input.trialEndsAt == null || input.trialEndsAt === "") {
    return true;
  }

  const ends = new Date(input.trialEndsAt).getTime();
  if (!Number.isNaN(ends) && ends > nowMs) {
    return true;
  }

  return isActiveSubscriptionStatus(input.subscriptionStatus);
}
