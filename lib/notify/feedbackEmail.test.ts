import { describe, expect, it } from "vitest";
import { buildFeedbackEmail } from "./feedbackEmail";

describe("buildFeedbackEmail", () => {
  it("uses phone in the subject when present", () => {
    const mail = buildFeedbackEmail({
      driverId: "drv-1",
      phone: "+14165550100",
      body: "Tabs work great",
    });
    expect(mail.subject).toBe("Fuel Dip feedback from +14165550100");
    expect(mail.text).toContain("drv-1");
    expect(mail.text).toContain("Tabs work great");
  });

  it("falls back to driver id when phone is missing", () => {
    const mail = buildFeedbackEmail({
      driverId: "drv-2",
      phone: null,
      body: "hello",
    });
    expect(mail.subject).toBe("Fuel Dip feedback from drv-2");
    expect(mail.text).toContain("Phone: (none)");
  });
});
