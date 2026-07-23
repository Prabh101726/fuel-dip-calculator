import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/calculator";

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
