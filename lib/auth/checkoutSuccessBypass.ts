/**
 * Whether middleware may skip my_access_active for /calculator?checkout=success.
 * Requires a Stripe customer id so random expired users cannot self-bypass
 * by appending the query string — only drivers who started Checkout qualify.
 */
export function shouldBypassAccessForCheckoutSuccess(input: {
  path: string;
  checkoutParam: string | null;
  stripeCustomerId: string | null | undefined;
}): boolean {
  if (input.path !== "/calculator") return false;
  if (input.checkoutParam !== "success") return false;
  return Boolean(input.stripeCustomerId);
}
