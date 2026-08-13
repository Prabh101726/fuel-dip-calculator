import type Stripe from "stripe";
import { stripeTrialEndUnix } from "@/lib/referral/grant";
import { periodEndIso } from "@/lib/billing/syncSubscription";

export async function extendStripeRenewalByBonusDays(
  stripe: Stripe,
  subscriptionId: string,
): Promise<void> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const trialEnd = stripeTrialEndUnix(
    periodEndIso(sub),
    Math.floor(Date.now() / 1000),
  );
  await stripe.subscriptions.update(subscriptionId, {
    trial_end: trialEnd,
    proration_behavior: "none",
  });
}
