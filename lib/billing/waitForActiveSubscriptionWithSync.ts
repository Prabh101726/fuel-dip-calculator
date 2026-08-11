import { isActiveSubscriptionStatus } from "./access";
import { syncSubscriptionFromStripe } from "./syncFromClient";
import {
  waitForActiveSubscription,
  type WaitForActiveSubscriptionOptions,
} from "./waitForActiveSubscription";

/**
 * After Checkout: pull from Stripe a couple of times while also polling the DB
 * (webhook may still be broken or lagging).
 */
export async function waitForActiveSubscriptionWithSync(
  readStatus: () => Promise<string | null | undefined>,
  options?: WaitForActiveSubscriptionOptions,
): Promise<boolean> {
  let attempts = 0;
  return waitForActiveSubscription(async () => {
    attempts += 1;
    // Immediate + ~2.4s later (attempt 4 @ 800ms interval).
    if (attempts === 1 || attempts === 4) {
      const synced = await syncSubscriptionFromStripe();
      if (isActiveSubscriptionStatus(synced)) return synced;
    }
    return readStatus();
  }, options);
}
