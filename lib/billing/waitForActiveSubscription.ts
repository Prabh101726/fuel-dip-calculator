import { isActiveSubscriptionStatus } from "./access";

export type WaitForActiveSubscriptionOptions = {
  timeoutMs?: number;
  intervalMs?: number;
  /** Optional abort — e.g. component unmount. */
  signal?: AbortSignal;
};

/**
 * Polls until the driver's subscription_status is active/trialing/past_due,
 * or until timeout. Used after Checkout return while the webhook may lag.
 */
export async function waitForActiveSubscription(
  fetchStatus: () => Promise<string | null | undefined>,
  options?: WaitForActiveSubscriptionOptions,
): Promise<boolean> {
  const timeoutMs = options?.timeoutMs ?? 10_000;
  const intervalMs = options?.intervalMs ?? 800;
  const signal = options?.signal;
  const deadline = Date.now() + timeoutMs;

  while (true) {
    if (signal?.aborted) return false;

    const status = await fetchStatus();
    if (isActiveSubscriptionStatus(status)) return true;

    if (Date.now() >= deadline) return false;
    if (signal?.aborted) return false;

    const remaining = deadline - Date.now();
    if (remaining <= 0) return false;
    await sleep(Math.min(intervalMs, remaining), signal);
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true },
    );
  });
}
