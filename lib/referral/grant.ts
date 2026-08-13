import { isActiveSubscriptionStatus } from "@/lib/billing/access";

export const REFERRAL_BONUS_DAYS = 14;

export function hasPaidStatus(status: string | null | undefined): boolean {
  return status === "active";
}

export type ReferralDriver = {
  id: string;
  referred_by: string | null;
  referral_rewarded_at: string | null;
};

export type ReferrerDriver = {
  id: string;
  subscription_status: string | null;
  stripe_subscription_id: string | null;
};

export type ReferralGrant =
  | { kind: "trial"; referrerId: string; referredId: string }
  | {
      kind: "stripe";
      referrerId: string;
      referredId: string;
      subscriptionId: string;
    };

export function decideReferralGrant(input: {
  referredStatus: string | null | undefined;
  referred: ReferralDriver;
  referrer: ReferrerDriver | null;
}): ReferralGrant | null {
  if (!hasPaidStatus(input.referredStatus)) return null;
  const { referred, referrer } = input;
  if (!referred.referred_by || referred.referral_rewarded_at) return null;
  if (!referrer || referrer.id !== referred.referred_by) return null;
  if (referrer.id === referred.id) return null;
  if (
    isActiveSubscriptionStatus(referrer.subscription_status) &&
    referrer.stripe_subscription_id
  ) {
    return {
      kind: "stripe",
      referrerId: referrer.id,
      referredId: referred.id,
      subscriptionId: referrer.stripe_subscription_id,
    };
  }
  return { kind: "trial", referrerId: referrer.id, referredId: referred.id };
}

export function addDaysIso(iso: string, days: number): string {
  const ms = new Date(iso).getTime() + days * 86_400_000;
  return new Date(ms).toISOString();
}

/** Null trial_ends_at means access-forever — do not invent a date. */
export function nextTrialEndsAt(
  trialEndsAt: string | null | undefined,
  now: Date,
): string | null {
  if (trialEndsAt == null || trialEndsAt === "") return null;
  const current = new Date(trialEndsAt).getTime();
  if (Number.isNaN(current)) return null;
  const base = Math.max(now.getTime(), current);
  return new Date(base + REFERRAL_BONUS_DAYS * 86_400_000).toISOString();
}

export function stripeTrialEndUnix(
  periodEndIso: string | null,
  nowUnix: number,
): number {
  const bonus = REFERRAL_BONUS_DAYS * 86_400;
  if (!periodEndIso) return nowUnix + bonus;
  const period = Math.floor(new Date(periodEndIso).getTime() / 1000);
  return Math.max(period, nowUnix) + bonus;
}
