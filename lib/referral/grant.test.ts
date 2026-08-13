import { describe, expect, it } from "vitest";
import {
  REFERRAL_BONUS_DAYS,
  addDaysIso,
  decideReferralGrant,
  nextTrialEndsAt,
  stripeTrialEndUnix,
} from "./grant";

const referred = {
  id: "new-1",
  referred_by: "sharer-1",
  referral_rewarded_at: null as string | null,
};
const sharerTrial = {
  id: "sharer-1",
  subscription_status: null as string | null,
  stripe_subscription_id: null as string | null,
};
const sharerPaid = {
  id: "sharer-1",
  subscription_status: "active",
  stripe_subscription_id: "sub_1",
};

describe("decideReferralGrant", () => {
  it("skips when unpaid friend or already rewarded or self", () => {
    expect(
      decideReferralGrant({
        referredStatus: "incomplete",
        referred,
        referrer: sharerTrial,
      }),
    ).toBeNull();
    expect(
      decideReferralGrant({
        referredStatus: "active",
        referred: { ...referred, referral_rewarded_at: "2026-01-01T00:00:00Z" },
        referrer: sharerTrial,
      }),
    ).toBeNull();
    expect(
      decideReferralGrant({
        referredStatus: "active",
        referred: { ...referred, referred_by: "new-1", id: "new-1" },
        referrer: { ...sharerTrial, id: "new-1" },
      }),
    ).toBeNull();
  });

  it("skips when referred is trialing or past_due", () => {
    expect(
      decideReferralGrant({
        referredStatus: "trialing",
        referred,
        referrer: sharerTrial,
      }),
    ).toBeNull();
    expect(
      decideReferralGrant({
        referredStatus: "past_due",
        referred,
        referrer: sharerTrial,
      }),
    ).toBeNull();
  });

  it("extends trial when sharer is not subscribed", () => {
    const d = decideReferralGrant({
      referredStatus: "active",
      referred,
      referrer: sharerTrial,
    });
    expect(d).toEqual({
      kind: "trial",
      referrerId: "sharer-1",
      referredId: "new-1",
    });
  });

  it("extends Stripe when sharer is paid", () => {
    const d = decideReferralGrant({
      referredStatus: "active",
      referred,
      referrer: sharerPaid,
    });
    expect(d).toEqual({
      kind: "stripe",
      referrerId: "sharer-1",
      referredId: "new-1",
      subscriptionId: "sub_1",
    });
  });

  it("still extends Stripe when the referrer is trialing or past_due", () => {
    const d = decideReferralGrant({
      referredStatus: "active",
      referred,
      referrer: { ...sharerPaid, subscription_status: "trialing" },
    });
    expect(d?.kind).toBe("stripe");
  });
});

describe("time helpers", () => {
  it("adds 14 days to an ISO timestamp", () => {
    expect(REFERRAL_BONUS_DAYS).toBe(14);
    expect(addDaysIso("2026-08-13T00:00:00.000Z", 14)).toBe(
      "2026-08-27T00:00:00.000Z",
    );
  });

  it("sets Stripe trial_end to period end plus 14 days", () => {
    const period = "2026-09-10T00:00:00.000Z";
    const unix = stripeTrialEndUnix(
      period,
      Date.parse("2026-08-13T00:00:00Z") / 1000,
    );
    expect(unix).toBe(Date.parse("2026-09-24T00:00:00.000Z") / 1000);
  });
});

describe("nextTrialEndsAt", () => {
  const now = new Date("2026-08-13T00:00:00.000Z");

  it("returns null when trial_ends_at is null (access-forever)", () => {
    expect(nextTrialEndsAt(null, now)).toBeNull();
  });

  it("extends from now when the trial already expired", () => {
    expect(nextTrialEndsAt("2026-07-01T00:00:00.000Z", now)).toBe(
      "2026-08-27T00:00:00.000Z",
    );
  });

  it("extends from trial_ends_at when it is still in the future", () => {
    expect(nextTrialEndsAt("2026-08-20T00:00:00.000Z", now)).toBe(
      "2026-09-03T00:00:00.000Z",
    );
  });
});
