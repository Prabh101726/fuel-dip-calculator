// Before User Created Auth Hook — reject non-+1 NANP phones.
// Enable in Supabase Dashboard → Authentication → Hooks → Before User Created
// Point at this function. verify_jwt must stay false (Auth Hook signature).
//
// Twilio Geo Permissions (CA+US) remain the cost backstop for SMS.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/** Auth stores phone digits without '+'; accept +1… or 1… forms. */
function isNanpPhone(phone: string | null | undefined): boolean {
  if (!phone) return true; // email-only paths (disabled in product, but allow)
  const digits = phone.replace(/\D/g, "");
  return /^1[2-9]\d{2}[2-9]\d{6}$/.test(digits);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let payload: { user?: { phone?: string | null } };
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: { http_code: 400, message: "Invalid JSON" } }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const phone = payload.user?.phone ?? null;
  if (!isNanpPhone(phone)) {
    return new Response(
      JSON.stringify({
        error: {
          http_code: 400,
          message: "Only Canada / US (+1) phone numbers are allowed.",
        },
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
