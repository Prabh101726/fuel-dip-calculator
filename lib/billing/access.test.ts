import { describe, expect, it } from "vitest";
import { isAccessActive } from "./access";

const now = new Date("2026-07-31T12:00:00.000Z");
const past = "2026-07-01T00:00:00.000Z";
const future = "2026-08-15T00:00:00.000Z";

describe("isAccessActive", () => {
  it("denies expired trial with no subscription", () => {
    expect(
      isAccessActive({
        trialEndsAt: past,
        subscriptionStatus: null,
        now,
      }),
    ).toBe(false);
  });

  it("allows expired trial when subscription is active", () => {
    expect(
      isAccessActive({
        trialEndsAt: past,
        subscriptionStatus: "active",
        now,
      }),
    ).toBe(true);
  });

  it("allows active trial without subscription", () => {
    expect(
      isAccessActive({
        trialEndsAt: future,
        subscriptionStatus: null,
        now,
      }),
    ).toBe(true);
  });

  it("allows null trialEndsAt (matches RLS)", () => {
    expect(
      isAccessActive({
        trialEndsAt: null,
        subscriptionStatus: null,
        now,
      }),
    ).toBe(true);
  });

  it("denies canceled subscription when trial expired", () => {
    expect(
      isAccessActive({
        trialEndsAt: past,
        subscriptionStatus: "canceled",
        now,
      }),
    ).toBe(false);
  });

  it("allows past_due during dunning", () => {
    expect(
      isAccessActive({
        trialEndsAt: past,
        subscriptionStatus: "past_due",
        now,
      }),
    ).toBe(true);
  });

  it("allows canceled if trial still open", () => {
    expect(
      isAccessActive({
        trialEndsAt: future,
        subscriptionStatus: "canceled",
        now,
      }),
    ).toBe(true);
  });
});
