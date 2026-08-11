import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { selectBestSubscription } from "./syncSubscription";

function sub(
  id: string,
  status: Stripe.Subscription.Status,
  created = 1_000,
): Stripe.Subscription {
  return { id, status, created } as Stripe.Subscription;
}

describe("selectBestSubscription", () => {
  it("prefers active over canceled", () => {
    const best = selectBestSubscription([
      sub("sub_old", "canceled", 100),
      sub("sub_live", "active", 200),
    ]);
    expect(best?.id).toBe("sub_live");
  });

  it("prefers past_due over incomplete", () => {
    const best = selectBestSubscription([
      sub("sub_inc", "incomplete", 300),
      sub("sub_due", "past_due", 200),
    ]);
    expect(best?.id).toBe("sub_due");
  });

  it("returns null when list empty", () => {
    expect(selectBestSubscription([])).toBeNull();
  });

  it("falls back to newest when none are access-granting", () => {
    const best = selectBestSubscription([
      sub("sub_a", "canceled", 100),
      sub("sub_b", "incomplete", 400),
    ]);
    expect(best?.id).toBe("sub_b");
  });
});
