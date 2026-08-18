import { CONTACT_EMAIL } from "@/lib/app-copy";
import { DEFAULT_RESEND_FROM } from "@/lib/notify/feedbackEmail";

export type SendEmailResult =
  | { status: "sent" }
  | { status: "skipped" }
  | { status: "failed"; detail: string };

export async function sendOperatorEmail(
  input: { subject: string; text: string },
  opts?: {
    env?: { RESEND_API_KEY?: string; RESEND_FROM?: string };
    fetchImpl?: typeof fetch;
  },
): Promise<SendEmailResult> {
  const env = opts?.env ?? process.env;
  const key = env.RESEND_API_KEY?.trim();
  if (!key) return { status: "skipped" };

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
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 500);
      console.error("resend send failed", res.status, detail);
      return { status: "failed", detail: `${res.status} ${detail}` };
    }
    return { status: "sent" };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "network";
    console.error("resend send failed", detail);
    return { status: "failed", detail };
  }
}
