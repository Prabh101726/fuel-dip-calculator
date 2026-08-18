import { NextResponse } from "next/server";
import { mapFeedbackSubmitError } from "@/lib/feedback/submit";
import { notifyOperatorOfFeedback } from "@/lib/notify/notifyOperatorOfFeedback";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to send feedback." }, { status: 401 });
  }

  let body = "";
  try {
    const json = (await request.json()) as { body?: unknown };
    body = typeof json.body === "string" ? json.body : "";
  } catch {
    return NextResponse.json({ error: "Write a short message first." }, { status: 400 });
  }

  const { error: rpcError } = await supabase.rpc("submit_feedback", {
    p_body: body,
  });
  if (rpcError) {
    return NextResponse.json(
      {
        error: mapFeedbackSubmitError({
          code: rpcError.code,
          message: rpcError.message,
        }),
      },
      { status: 400 },
    );
  }

  try {
    await notifyOperatorOfFeedback({
      driverId: user.id,
      phone: user.phone ?? null,
      body: body.trim(),
    });
  } catch (err) {
    console.error("feedback notify failed", err);
  }

  return NextResponse.json({ ok: true });
}
