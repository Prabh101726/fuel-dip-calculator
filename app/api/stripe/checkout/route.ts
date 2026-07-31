import { NextResponse } from "next/server";
import { getStripe, getStripePriceId } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function appOrigin(request: Request): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (env) return env;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;
  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: driver, error: driverErr } = await supabase
    .from("drivers")
    .select("id, stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  if (driverErr || !driver) {
    return NextResponse.json({ error: "Driver not found" }, { status: 400 });
  }

  const stripe = getStripe();
  const priceId = getStripePriceId();
  const origin = appOrigin(request);

  let customerId = driver.stripe_customer_id as string | null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { driver_id: driver.id },
    });
    customerId = customer.id;
    // drivers has no UPDATE RLS for clients — persist via service role.
    const admin = createAdminClient();
    const { error: saveErr } = await admin
      .from("drivers")
      .update({ stripe_customer_id: customerId })
      .eq("id", driver.id);
    if (saveErr) {
      return NextResponse.json(
        { error: "Could not save Stripe customer" },
        { status: 500 },
      );
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: driver.id,
    metadata: { driver_id: driver.id },
    subscription_data: {
      metadata: { driver_id: driver.id },
    },
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/calculator?checkout=success`,
    cancel_url: `${origin}/trial-ended?checkout=cancel`,
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Checkout session missing URL" },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: session.url });
}
