import { NextResponse } from "next/server";
import {
  billingPatchFromSubscription,
  selectBestSubscription,
} from "@/lib/billing/syncSubscription";
import { getStripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Pull the driver's Stripe subscription into `drivers` when the webhook
 * lagged or failed. Called after Checkout return (`checkout=success`).
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: driver, error: driverErr } = await supabase
    .from("drivers")
    .select("id, stripe_customer_id, subscription_status")
    .eq("id", user.id)
    .maybeSingle();

  if (driverErr || !driver) {
    return NextResponse.json({ error: "Driver not found" }, { status: 400 });
  }

  if (!driver.stripe_customer_id) {
    return NextResponse.json(
      { error: "No Stripe customer", subscription_status: null },
      { status: 404 },
    );
  }

  const stripe = getStripe();
  const listed = await stripe.subscriptions.list({
    customer: driver.stripe_customer_id,
    status: "all",
    limit: 10,
  });

  const best = selectBestSubscription(listed.data);
  if (!best) {
    return NextResponse.json({
      synced: false,
      subscription_status: driver.subscription_status,
    });
  }

  const patch = Object.fromEntries(
    Object.entries(billingPatchFromSubscription(best)).filter(
      ([, v]) => v !== undefined,
    ),
  );

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("drivers")
    .update(patch)
    .eq("id", driver.id)
    .select("subscription_status")
    .maybeSingle();

  if (error) {
    console.error("stripe sync driver update failed", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({
    synced: true,
    subscription_status: data?.subscription_status ?? best.status,
  });
}
