import { CONTACT_EMAIL } from "@/lib/app-copy";
import { DEFAULT_RESEND_FROM } from "@/lib/notify/feedbackEmail";

export type SendEmailResult = "sent" | "skipped" | "failed";

export async function sendOperatorEmail(
  input: { subject: string; text: string },
  opts?: {
    env?: { RESEND_API_KEY?: string; RESEND_FROM?: string };
    fetchImpl?: typeof fetch;
  },
): Promise<SendEmailResult> {
  const env = opts?.env ?? process.env;
  const key = env.RESEND_API_KEY?.trim();
  if (!key) return "skipped";

  const fetchImpl = opts?.fetchImpl ?? fetch;
  const from = env.RESEND_FROM?.trim() || DEFAULT_RESEND_FROM;

  try {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [CONTACT_EMAIL],
        subject: input.subject,
        text: input.text,
      }),
    });
    if (!res.ok) return "failed";
    return "sent";
  } catch {
    return "failed";
  }
}
