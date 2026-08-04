import { describe, expect, it } from "vitest";
import { shouldShowBillingLink } from "./shouldShowBillingLink";

describe("shouldShowBillingLink", () => {
  it("hides Billing after abandoned Checkout (customer, no status)", () => {
    expect(
      shouldShowBillingLink({
        hasStripeCustomer: true,
        subscriptionStatus: null,
      }),
    ).toBe(false);
  });

  it("shows Billing when subscription is active", () => {
    expect(
      shouldShowBillingLink({
        hasStripeCustomer: true,
        subscriptionStatus: "active",
      }),
    ).toBe(true);
  });

  it("shows Billing for canceled so driver can reopen portal", () => {
    expect(
      shouldShowBillingLink({
        hasStripeCustomer: true,
        subscriptionStatus: "canceled",
      }),
    ).toBe(true);
  });

  it("shows Billing when status is active even if customer flag lagged", () => {
    expect(
      shouldShowBillingLink({
        hasStripeCustomer: false,
        subscriptionStatus: "active",
      }),
    ).toBe(true);
  });

  it("hides Billing with no customer and no status", () => {
    expect(
      shouldShowBillingLink({
        hasStripeCustomer: false,
        subscriptionStatus: null,
      }),
    ).toBe(false);
  });
});
