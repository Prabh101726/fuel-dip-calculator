import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { shouldBypassAccessForCheckoutSuccess } from "@/lib/auth/checkoutSuccessBypass";
import { isPublicPath } from "@/lib/auth/isPublicPath";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = isPublicPath(path);
  // Auth required, but not gated on my_access_active (early subscribe during trial).
  const isAuthOnly = path === "/subscribe" || path === "/feedback";

  if (!user && !isPublic && path !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    if (isAuthOnly) {
      url.searchParams.set("next", path);
    }
    return NextResponse.redirect(url);
  }

  if (!user && path === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/calculator";
    return NextResponse.redirect(url);
  }

  // /subscribe: signed-in users only; skip access gate so trial drivers can pay early.
  // After Checkout, allow /calculator?checkout=success only if they already have a
  // Stripe customer (started Checkout) so expired users cannot self-bypass.
  if (user && (path === "/calculator" || path === "/history" || path === "/")) {
    let awaitingCheckout = false;
    if (
      path === "/calculator" &&
      request.nextUrl.searchParams.get("checkout") === "success"
    ) {
      const { data: driver } = await supabase
        .from("drivers")
        .select("stripe_customer_id")
        .eq("id", user.id)
        .maybeSingle();
      awaitingCheckout = shouldBypassAccessForCheckoutSuccess({
        path,
        checkoutParam: request.nextUrl.searchParams.get("checkout"),
        stripeCustomerId:
          typeof driver?.stripe_customer_id === "string"
            ? driver.stripe_customer_id
            : null,
      });
    }
    if (!awaitingCheckout) {
      const { data: accessActive, error } = await supabase.rpc("my_access_active");
      if (error || accessActive !== true) {
        const url = request.nextUrl.clone();
        url.pathname = "/trial-ended";
        return NextResponse.redirect(url);
      }
    }
    if (path === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/calculator";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
