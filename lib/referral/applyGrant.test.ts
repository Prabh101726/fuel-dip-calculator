import { describe, expect, it, vi } from "vitest";
import { applyReferralGrantForDriver } from "./applyGrant";

type DriverRow = {
  id: string;
  referred_by: string | null;
  referral_rewarded_at: string | null;
  subscription_status: string | null;
  stripe_subscription_id: string | null;
  company_id: string;
  referral_days_granted: number;
};

function createFakeAdmin(input: {
  drivers: DriverRow[];
  companies: Record<string, { trial_ends_at: string | null }>;
}) {
  const drivers = new Map(input.drivers.map((d) => [d.id, { ...d }]));
  const companies = { ...input.companies };
  const companyUpdates: { id: string; trial_ends_at: string }[] = [];
  const rpcCalls: string[] = [];

  const admin = {
    rpc: async (name: string, args: { p_referred: string }) => {
      rpcCalls.push(name);
      const referred = drivers.get(args.p_referred);
      if (name === "claim_referral_reward") {
        if (
          !referred ||
          referred.referral_rewarded_at ||
          !referred.referred_by
        ) {
          return { data: null, error: null };
        }
        referred.referral_rewarded_at = "2026-08-13T00:00:00.000Z";
        const referrer = drivers.get(referred.referred_by);
        if (referrer) referrer.referral_days_granted += 14;
        return { data: referred.referred_by, error: null };
      }
      if (name === "unclaim_referral_reward") {
        if (referred?.referral_rewarded_at && referred.referred_by) {
          referred.referral_rewarded_at = null;
          const referrer = drivers.get(referred.referred_by);
          if (referrer) {
            referrer.referral_days_granted = Math.max(
              0,
              referrer.referral_days_granted - 14,
            );
          }
        }
        return { data: null, error: null };
      }
      return { data: null, error: { message: `unknown rpc ${name}` } };
    },
    from(table: string) {
      return {
        select() {
          return {
            eq(col: string, val: string) {
              return {
                async maybeSingle() {
                  if (table === "drivers" && col === "id") {
                    return { data: drivers.get(val) ?? null, error: null };
                  }
                  if (table === "companies" && col === "id") {
                    const row = companies[val];
                    return {
                      data: row ? { trial_ends_at: row.trial_ends_at } : null,
                      error: null,
                    };
                  }
                  return { data: null, error: null };
                },
              };
            },
          };
        },
        update(patch: Record<string, unknown>) {
          return {
            async eq(col: string, val: string) {
              if (
                table === "companies" &&
                col === "id" &&
                typeof patch.trial_ends_at === "string"
              ) {
                companies[val] = { trial_ends_at: patch.trial_ends_at };
                companyUpdates.push({
                  id: val,
                  trial_ends_at: patch.trial_ends_at,
                });
              }
              return { error: null };
            },
          };
        },
      };
    },
  };

  return { admin, drivers, companies, companyUpdates, rpcCalls };
}

const referred: DriverRow = {
  id: "new-1",
  referred_by: "sharer-1",
  referral_rewarded_at: null,
  subscription_status: "active",
  stripe_subscription_id: "sub_new",
  company_id: "co-new",
  referral_days_granted: 0,
};

const sharerTrial: DriverRow = {
  id: "sharer-1",
  referred_by: null,
  referral_rewarded_at: null,
  subscription_status: null,
  stripe_subscription_id: null,
  company_id: "co-sharer",
  referral_days_granted: 0,
};

describe("applyReferralGrantForDriver", () => {
  const now = new Date("2026-08-13T00:00:00.000Z");

  it("extends a live trial clock from max(now, trial_ends_at)", async () => {
    const fake = createFakeAdmin({
      drivers: [referred, sharerTrial],
      companies: { "co-sharer": { trial_ends_at: "2026-08-20T00:00:00.000Z" } },
    });

    await applyReferralGrantForDriver(fake.admin, "new-1", "active", { now });

    expect(fake.companyUpdates).toEqual([
      { id: "co-sharer", trial_ends_at: "2026-09-03T00:00:00.000Z" },
    ]);
    expect(fake.drivers.get("new-1")?.referral_rewarded_at).not.toBeNull();
    expect(fake.drivers.get("sharer-1")?.referral_days_granted).toBe(14);
    expect(fake.rpcCalls).toEqual(["claim_referral_reward"]);
  });

  it("releases the claim when trial_ends_at is null", async () => {
    const fake = createFakeAdmin({
      drivers: [referred, sharerTrial],
      companies: { "co-sharer": { trial_ends_at: null } },
    });

    await expect(
      applyReferralGrantForDriver(fake.admin, "new-1", "active", { now }),
    ).rejects.toThrow(/no trial clock/i);

    expect(fake.companyUpdates).toEqual([]);
    expect(fake.drivers.get("new-1")?.referral_rewarded_at).toBeNull();
    expect(fake.drivers.get("sharer-1")?.referral_days_granted).toBe(0);
    expect(fake.rpcCalls).toEqual([
      "claim_referral_reward",
      "unclaim_referral_reward",
    ]);
  });

  it("unclaims when Stripe extend fails", async () => {
    const fake = createFakeAdmin({
      drivers: [
        referred,
        {
          ...sharerTrial,
          subscription_status: "active",
          stripe_subscription_id: "sub_1",
        },
      ],
      companies: { "co-sharer": { trial_ends_at: "2026-08-20T00:00:00.000Z" } },
    });
    const extendStripe = vi.fn().mockRejectedValue(new Error("stripe down"));

    await expect(
      applyReferralGrantForDriver(fake.admin, "new-1", "active", {
        now,
        extendStripe,
      }),
    ).rejects.toThrow("stripe down");

    expect(fake.drivers.get("new-1")?.referral_rewarded_at).toBeNull();
    expect(fake.drivers.get("sharer-1")?.referral_days_granted).toBe(0);
    expect(fake.rpcCalls).toEqual([
      "claim_referral_reward",
      "unclaim_referral_reward",
    ]);
  });
});
