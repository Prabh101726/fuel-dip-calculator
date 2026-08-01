/**
 * Customer Portal link: only after Stripe has set a subscription status.
 * Opening Checkout creates a customer immediately — that alone must not
 * show Billing (driver may abandon without paying).
 */
export function shouldShowBillingLink(input: {
  hasStripeCustomer: boolean;
  subscriptionStatus: string | null | undefined;
}): boolean {
  if (!input.hasStripeCustomer) return false;
  return (
    typeof input.subscriptionStatus === "string" &&
    input.subscriptionStatus.trim() !== ""
  );
}
