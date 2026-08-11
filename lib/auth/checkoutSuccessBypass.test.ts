import { describe, expect, it } from "vitest";
import { shouldBypassAccessForCheckoutSuccess } from "./checkoutSuccessBypass";

describe("shouldBypassAccessForCheckoutSuccess", () => {
  it("allows calculator checkout=success when Stripe customer exists", () => {
    expect(
      shouldBypassAccessForCheckoutSuccess({
        path: "/calculator",
        checkoutParam: "success",
        stripeCustomerId: "cus_abc",
      }),
    ).toBe(true);
  });

  it("denies bypass without Stripe customer", () => {
    expect(
      shouldBypassAccessForCheckoutSuccess({
        path: "/calculator",
        checkoutParam: "success",
        stripeCustomerId: null,
      }),
    ).toBe(false);
  });

  it("denies bypass on history even with customer", () => {
    expect(
      shouldBypassAccessForCheckoutSuccess({
        path: "/history",
        checkoutParam: "success",
        stripeCustomerId: "cus_abc",
      }),
    ).toBe(false);
  });

  it("denies bypass when checkout param missing", () => {
    expect(
      shouldBypassAccessForCheckoutSuccess({
        path: "/calculator",
        checkoutParam: null,
        stripeCustomerId: "cus_abc",
      }),
    ).toBe(false);
  });
});
