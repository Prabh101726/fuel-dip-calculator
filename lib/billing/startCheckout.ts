/**
 * Starts Stripe Checkout for the signed-in driver.
 * Returns the Checkout URL, or throws with a user-facing message.
 */
export async function startCheckout(): Promise<string> {
  const res = await fetch("/api/stripe/checkout", { method: "POST" });
  const data = (await res.json().catch(() => ({}))) as {
    url?: string;
    error?: string;
  };
  if (!res.ok || !data.url) {
    throw new Error(data.error ?? "Could not start checkout.");
  }
  return data.url;
}
