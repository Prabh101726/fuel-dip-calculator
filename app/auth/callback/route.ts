import { NextResponse } from "next/server";
import { safeAuthCallbackNext } from "@/lib/auth/safeNextPath";
import { createClient } from "@/lib/supabase/server";

/** Optional PKCE / OAuth redirects; primary auth is phone OTP on /login. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeAuthCallbackNext(searchParams.get("next"));
  const errorCode = searchParams.get("error_code") ?? searchParams.get("error");

  if (errorCode) {
    const codeParam = searchParams.get("error_code") ?? "";
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorCode)}&error_code=${encodeURIComponent(codeParam)}`,
    );
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await supabase.rpc("ensure_trial_driver");

      const { data: accessActive, error: accessErr } =
        await supabase.rpc("my_access_active");
      if (accessErr || accessActive !== true) {
        return NextResponse.redirect(`${origin}/trial-ended`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
