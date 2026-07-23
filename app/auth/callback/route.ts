import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Kept for optional email-confirm redirects; primary auth is email/password on /login. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/calculator";
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

      const { data: trialEndsAt } = await supabase.rpc("my_trial_ends_at");
      if (trialEndsAt && new Date(trialEndsAt as string).getTime() <= Date.now()) {
        return NextResponse.redirect(`${origin}/trial-ended`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
