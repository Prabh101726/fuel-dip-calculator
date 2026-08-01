import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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
  const isPublic =
    path === "/login" ||
    path.startsWith("/auth/") ||
    path === "/trial-ended" ||
    path === "/privacy" ||
    path === "/terms" ||
    path === "/api/stripe/webhook";
  // Auth required, but not gated on my_access_active (early subscribe during trial).
  const isAuthOnly = path === "/subscribe";

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
  if (user && (path === "/calculator" || path === "/history" || path === "/")) {
    const { data: accessActive, error } = await supabase.rpc("my_access_active");
    if (error || accessActive !== true) {
      const url = request.nextUrl.clone();
      url.pathname = "/trial-ended";
      return NextResponse.redirect(url);
    }
    if (path === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/calculator";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
