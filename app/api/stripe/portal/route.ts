import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
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

  const { data: driver, error } = await supabase
    .from("drivers")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !driver?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No billing customer for this driver" },
      { status: 400 },
    );
  }

  const stripe = getStripe();
  const origin = appOrigin(request);
  const portal = await stripe.billingPortal.sessions.create({
    customer: driver.stripe_customer_id,
    return_url: `${origin}/calculator`,
  });

  return NextResponse.json({ url: portal.url });
}
