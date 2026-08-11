import type Stripe from "stripe";
import { isActiveSubscriptionStatus } from "./access";
import type { DriverBillingPatch } from "./webhook";

/**
 * Prefer a subscription that grants app access; otherwise newest by created.
 */
export function selectBestSubscription(
  subscriptions: Stripe.Subscription[],
): Stripe.Subscription | null {
  if (subscriptions.length === 0) return null;

  const granting = subscriptions.filter((s) =>
    isActiveSubscriptionStatus(s.status),
  );
  const pool = granting.length > 0 ? granting : subscriptions;
  return pool.reduce((a, b) => (a.created >= b.created ? a : b));
}

export function billingPatchFromSubscription(
  sub: Stripe.Subscription,
): DriverBillingPatch {
  return {
    stripe_customer_id:
      typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
    stripe_subscription_id: sub.id,
    subscription_status: sub.status,
    subscription_price_id: priceIdFromSub(sub),
    subscription_current_period_end: periodEndIso(sub),
  };
}

function priceIdFromSub(sub: Stripe.Subscription): string | null {
  const item = sub.items?.data?.[0];
  const price = item?.price;
  if (!price) return null;
  return typeof price === "string" ? price : price.id;
}

/** Top-level current_period_end (older API) or first item (2026+ API). */
export function periodEndIso(sub: Stripe.Subscription): string | null {
  const top = (sub as Stripe.Subscription & { current_period_end?: number })
    .current_period_end;
  if (typeof top === "number") {
    return new Date(top * 1000).toISOString();
  }
  const itemEnd = (
    sub.items?.data?.[0] as { current_period_end?: number } | undefined
  )?.current_period_end;
  if (typeof itemEnd === "number") {
    return new Date(itemEnd * 1000).toISOString();
  }
  return null;
}
