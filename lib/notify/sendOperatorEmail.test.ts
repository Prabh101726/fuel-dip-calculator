import { afterEach, describe, expect, it, vi } from "vitest";
import { CONTACT_EMAIL } from "@/lib/app-copy";
import { sendOperatorEmail } from "./sendOperatorEmail";

describe("sendOperatorEmail", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("skips when RESEND_API_KEY is missing", async () => {
    const fetchImpl = vi.fn();
    await expect(
      sendOperatorEmail(
        { subject: "s", text: "t" },
        { env: {}, fetchImpl: fetchImpl as unknown as typeof fetch },
      ),
    ).resolves.toBe("skipped");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("posts to Resend and returns sent", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    await expect(
      sendOperatorEmail(
        { subject: "Fuel Dip feedback", text: "hello" },
        {
          env: { RESEND_API_KEY: "re_test" },
          fetchImpl: fetchImpl as unknown as typeof fetch,
        },
      ),
    ).resolves.toBe("sent");

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    const body = JSON.parse(String(init.body)) as {
      to: string[];
      subject: string;
      text: string;
    };
    expect(body.to).toEqual([CONTACT_EMAIL]);
    expect(body.subject).toBe("Fuel Dip feedback");
    expect(body.text).toBe("hello");
  });

  it("returns failed when Resend is not ok", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false });
    await expect(
      sendOperatorEmail(
        { subject: "s", text: "t" },
        {
          env: { RESEND_API_KEY: "re_test" },
          fetchImpl: fetchImpl as unknown as typeof fetch,
        },
      ),
    ).resolves.toBe("failed");
  });
});
