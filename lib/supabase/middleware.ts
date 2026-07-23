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
    path === "/trial-ended";

  if (!user && !isPublic && path !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
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

  if (user && (path === "/calculator" || path === "/history" || path === "/")) {
    const { data: trialEndsAt, error } = await supabase.rpc("my_trial_ends_at");
    if (!error && trialEndsAt) {
      const ends = new Date(trialEndsAt as string);
      if (ends.getTime() <= Date.now()) {
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
