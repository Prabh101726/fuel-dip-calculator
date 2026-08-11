/**
 * Asks the server to copy the driver's Stripe subscription into `drivers`.
 * Used after Checkout when the webhook may not have written yet.
 */
export async function syncSubscriptionFromStripe(): Promise<string | null> {
  const res = await fetch("/api/stripe/sync", { method: "POST" });
  if (!res.ok) return null;
  const body = (await res.json()) as { subscription_status?: string | null };
  return typeof body.subscription_status === "string"
    ? body.subscription_status
    : null;
}
