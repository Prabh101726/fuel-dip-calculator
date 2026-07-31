import type Stripe from "stripe";

export type DriverBillingPatch = {
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_status?: string | null;
  subscription_price_id?: string | null;
  subscription_current_period_end?: string | null;
};

export type DriverBillingUpdate = {
  driverId: string | null;
  stripeCustomerId: string | null;
  patch: DriverBillingPatch;
};

function periodEndIso(sub: Stripe.Subscription): string | null {
  // Stripe Node types for newer API versions may omit this field on Subscription.
  const end = (sub as Stripe.Subscription & { current_period_end?: number })
    .current_period_end;
  if (typeof end !== "number") return null;
  return new Date(end * 1000).toISOString();
}

function priceIdFromSub(sub: Stripe.Subscription): string | null {
  const item = sub.items?.data?.[0];
  const price = item?.price;
  if (!price) return null;
  return typeof price === "string" ? price : price.id;
}

function patchFromSubscription(sub: Stripe.Subscription): DriverBillingPatch {
  return {
    stripe_customer_id:
      typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
    stripe_subscription_id: sub.id,
    subscription_status: sub.status,
    subscription_price_id: priceIdFromSub(sub),
    subscription_current_period_end: periodEndIso(sub),
  };
}

/**
 * Maps a Stripe event to a drivers-row patch. Returns null if the event
 * should be ignored (unsupported type or missing identifiers).
 */
export function driverPatchFromStripeEvent(
  event: Stripe.Event,
): DriverBillingUpdate | null {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") return null;
      const driverId =
        session.metadata?.driver_id ??
        session.client_reference_id ??
        null;
      const customerId =
        typeof session.customer === "string"
          ? session.customer
          : session.customer?.id ?? null;
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id ?? null;
      if (!driverId && !customerId) return null;
      return {
        driverId,
        stripeCustomerId: customerId,
        patch: {
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          // Status often arrives on subscription.* events; mark active on paid checkout.
          subscription_status:
            session.payment_status === "paid" ||
            session.payment_status === "no_payment_required"
              ? "active"
              : undefined,
        },
      };
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const driverId = sub.metadata?.driver_id ?? null;
      const customerId =
        typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;
      return {
        driverId,
        stripeCustomerId: customerId,
        patch: patchFromSubscription(sub),
      };
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const driverId = sub.metadata?.driver_id ?? null;
      const customerId =
        typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;
      return {
        driverId,
        stripeCustomerId: customerId,
        patch: {
          ...patchFromSubscription(sub),
          subscription_status: "canceled",
        },
      };
    }
    default:
      return null;
  }
}
