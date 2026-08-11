import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { driverPatchFromStripeEvent } from "./webhook";

function asEvent(
  type: Stripe.Event.Type,
  object: Record<string, unknown>,
): Stripe.Event {
  return {
    id: "evt_test",
    object: "event",
    type,
    data: { object },
  } as unknown as Stripe.Event;
}

describe("driverPatchFromStripeEvent", () => {
  it("maps checkout.session.completed to driver + customer", () => {
    const update = driverPatchFromStripeEvent(
      asEvent("checkout.session.completed", {
        mode: "subscription",
        payment_status: "paid",
        metadata: { driver_id: "drv-1" },
        client_reference_id: "drv-1",
        customer: "cus_1",
        subscription: "sub_1",
      }),
    );
    expect(update).toEqual({
      driverId: "drv-1",
      stripeCustomerId: "cus_1",
      patch: {
        stripe_customer_id: "cus_1",
        stripe_subscription_id: "sub_1",
        subscription_status: "active",
      },
    });
  });

  it("maps subscription.updated status and period end", () => {
    const update = driverPatchFromStripeEvent(
      asEvent("customer.subscription.updated", {
        id: "sub_2",
        status: "past_due",
        customer: "cus_2",
        metadata: { driver_id: "drv-2" },
        current_period_end: 1_800_000_000,
        items: {
          data: [{ price: { id: "price_abc" } }],
        },
      }),
    );
    expect(update?.driverId).toBe("drv-2");
    expect(update?.patch.subscription_status).toBe("past_due");
    expect(update?.patch.subscription_price_id).toBe("price_abc");
    expect(update?.patch.subscription_current_period_end).toBe(
      new Date(1_800_000_000 * 1000).toISOString(),
    );
  });

  it("reads period end from subscription item when top-level missing (2026 API)", () => {
    const update = driverPatchFromStripeEvent(
      asEvent("customer.subscription.updated", {
        id: "sub_item_period",
        status: "active",
        customer: "cus_x",
        metadata: { driver_id: "drv-x" },
        items: {
          data: [
            {
              price: { id: "price_abc" },
              current_period_end: 1_800_000_100,
            },
          ],
        },
      }),
    );
    expect(update?.patch.subscription_current_period_end).toBe(
      new Date(1_800_000_100 * 1000).toISOString(),
    );
  });

  it("maps subscription.deleted to canceled", () => {
    const update = driverPatchFromStripeEvent(
      asEvent("customer.subscription.deleted", {
        id: "sub_3",
        status: "canceled",
        customer: "cus_3",
        metadata: { driver_id: "drv-3" },
        current_period_end: null,
        items: { data: [] },
      }),
    );
    expect(update?.patch.subscription_status).toBe("canceled");
  });

  it("ignores unrelated events", () => {
    expect(
      driverPatchFromStripeEvent(
        asEvent("charge.succeeded", { id: "ch_1" }),
      ),
    ).toBeNull();
  });
});
