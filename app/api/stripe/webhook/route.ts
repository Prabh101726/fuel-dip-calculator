import { NextResponse } from "next/server";
import { driverPatchFromStripeEvent } from "@/lib/billing/webhook";
import { applyReferralGrantForDriver } from "@/lib/referral/applyGrant";
import { getStripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET is not set" },
      { status: 500 },
    );
  }

  const stripe = getStripe();
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const update = driverPatchFromStripeEvent(event);
  if (!update) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const admin = createAdminClient();
  const patch = Object.fromEntries(
    Object.entries(update.patch).filter(([, v]) => v !== undefined),
  );

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ received: true });
  }

  let query = admin.from("drivers").update(patch);
  if (update.driverId) {
    query = query.eq("id", update.driverId);
  } else if (update.stripeCustomerId) {
    query = query.eq("stripe_customer_id", update.stripeCustomerId);
  } else {
    return NextResponse.json({ received: true, ignored: true });
  }

  const { data, error } = await query.select("id, subscription_status");
  if (error) {
    console.error("stripe webhook driver update failed", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  if (!data || data.length === 0) {
    console.error("stripe webhook: no driver row matched", {
      driverId: update.driverId,
      stripeCustomerId: update.stripeCustomerId,
    });
    return NextResponse.json({ error: "No matching driver" }, { status: 500 });
  }

  for (const row of data) {
    const status =
      typeof row.subscription_status === "string"
        ? row.subscription_status
        : null;
    await applyReferralGrantForDriver(admin, row.id, status);
  }

  return NextResponse.json({ received: true });
}
