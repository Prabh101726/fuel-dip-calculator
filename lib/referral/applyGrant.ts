import { getStripe } from "@/lib/stripe/server";
import { extendStripeRenewalByBonusDays } from "@/lib/stripe/extendSubscription";
import {
  decideReferralGrant,
  nextTrialEndsAt,
  type ReferralDriver,
  type ReferrerDriver,
} from "@/lib/referral/grant";

/**
 * Claim-then-apply referral credit.
 *
 * Race: Checkout return polls /api/stripe/sync while the webhook fires.
 * claim_referral_reward is the atomic CAS (referral_rewarded_at IS NULL).
 *
 * Re-entry: extending the referrer's Stripe sub emits customer.subscription.updated,
 * which re-runs this for the referrer. decideReferralGrant / claim returns null
 * (referrer usually has referred_by null; even if not, their own rewarded_at is unrelated
 * and the original referred row is already claimed).
 *
 * After a credit, a paying referrer's subscription_status becomes "trialing";
 * isActiveSubscriptionStatus already accepts that → calculator still shows Plan active.
 *
 * Crash window: a hard kill between claim_referral_reward and unclaim_referral_reward
 * leaves referral_rewarded_at set. Stripe retries hit the claim guard and stop.
 * Repair: SELECT unclaim_referral_reward('<referred-uuid>'::uuid);
 */

export type ReferralGrantAdmin = {
  // Supabase query builders are too deep to re-declare; from() is the real client.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
  rpc: (
    name: string,
    args: { p_referred: string },
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export type ApplyGrantDeps = {
  now?: Date;
  extendStripe?: (subscriptionId: string) => Promise<void>;
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function throwIfError(error: { message: string } | null, label: string): void {
  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }
}

export async function applyReferralGrantForDriver(
  admin: ReferralGrantAdmin,
  referredId: string,
  referredStatus?: string | null,
  deps: ApplyGrantDeps = {},
): Promise<void> {
  const now = deps.now ?? new Date();
  const extendStripe =
    deps.extendStripe ??
    ((subscriptionId: string) =>
      extendStripeRenewalByBonusDays(getStripe(), subscriptionId));

  const { data: referredRow, error: referredErr } = await admin
    .from("drivers")
    .select(
      "id, referred_by, referral_rewarded_at, subscription_status, stripe_subscription_id, company_id",
    )
    .eq("id", referredId)
    .maybeSingle();
  throwIfError(referredErr, "load referred driver");
  if (!referredRow) return;

  const referred: ReferralDriver = {
    id: asString(referredRow.id) ?? referredId,
    referred_by: asString(referredRow.referred_by),
    referral_rewarded_at: asString(referredRow.referral_rewarded_at),
  };
  const status = referredStatus ?? asString(referredRow.subscription_status);
  if (!referred.referred_by) return;

  const { data: referrerRow, error: referrerErr } = await admin
    .from("drivers")
    .select("id, subscription_status, stripe_subscription_id, company_id")
    .eq("id", referred.referred_by)
    .maybeSingle();
  throwIfError(referrerErr, "load referrer");

  const referrer: ReferrerDriver | null = referrerRow
    ? {
        id: asString(referrerRow.id) ?? referred.referred_by,
        subscription_status: asString(referrerRow.subscription_status),
        stripe_subscription_id: asString(referrerRow.stripe_subscription_id),
      }
    : null;

  const decision = decideReferralGrant({
    referredStatus: status,
    referred,
    referrer,
  });
  if (!decision) return;

  const { data: claimed, error: claimErr } = await admin.rpc(
    "claim_referral_reward",
    { p_referred: referredId },
  );
  throwIfError(claimErr, "claim_referral_reward");
  if (claimed == null || claimed === "") return;

  try {
    if (decision.kind === "trial") {
      const companyId = asString(referrerRow?.company_id);
      if (!companyId) {
        throw new Error("Referrer company missing");
      }
      const { data: company, error: companyErr } = await admin
        .from("companies")
        .select("trial_ends_at")
        .eq("id", companyId)
        .maybeSingle();
      throwIfError(companyErr, "load company");
      if (!company) {
        throw new Error("Company not found");
      }
      const next = nextTrialEndsAt(asString(company.trial_ends_at), now);
      if (next == null) {
        throw new Error("Referrer has no trial clock to extend");
      }
      const { error: updErr } = await admin
        .from("companies")
        .update({ trial_ends_at: next })
        .eq("id", companyId);
      throwIfError(updErr, "update trial_ends_at");
    } else {
      await extendStripe(decision.subscriptionId);
    }
  } catch (err) {
    const { error: unclaimErr } = await admin.rpc("unclaim_referral_reward", {
      p_referred: referredId,
    });
    if (unclaimErr) {
      console.error("unclaim_referral_reward failed", unclaimErr);
    }
    throw err;
  }
}
