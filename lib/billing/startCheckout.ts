import { safeCheckoutCancelPath } from "@/lib/auth/safeNextPath";

export type StartCheckoutOptions = {
  /** Where Stripe sends the driver on cancel. Default: /trial-ended */
  cancelPath?: "/subscribe" | "/trial-ended";
};

/**
 * Starts Stripe Checkout for the signed-in driver.
 * Returns the Checkout URL, or throws with a user-facing message.
 */
export async function startCheckout(
  options?: StartCheckoutOptions,
): Promise<string> {
  const cancelPath = safeCheckoutCancelPath(options?.cancelPath ?? null);
  const res = await fetch("/api/stripe/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cancelPath }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    url?: string;
    error?: string;
  };
  if (!res.ok || !data.url) {
    throw new Error(data.error ?? "Could not start checkout.");
  }
  return data.url;
}
