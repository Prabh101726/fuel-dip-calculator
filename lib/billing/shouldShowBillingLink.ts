import { isActiveSubscriptionStatus } from "@/lib/billing/access";

/**
 * Customer Portal link: only after Stripe has set a subscription status.
 * Opening Checkout creates a customer immediately — that alone must not
 * show Billing (driver may abandon without paying).
 *
 * Active / trialing / past_due always show Billing even if the client
 * `hasStripeCustomer` flag lagged (e.g. IDB paint before online refresh).
 */
export function shouldShowBillingLink(input: {
  hasStripeCustomer: boolean;
  subscriptionStatus: string | null | undefined;
}): boolean {
  if (isActiveSubscriptionStatus(input.subscriptionStatus)) {
    return true;
  }
  if (!input.hasStripeCustomer) return false;
  return (
    typeof input.subscriptionStatus === "string" &&
    input.subscriptionStatus.trim() !== ""
  );
}
