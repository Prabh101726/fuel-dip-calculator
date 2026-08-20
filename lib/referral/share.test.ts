import { describe, expect, it } from "vitest";
import { APP_ORIGIN } from "@/lib/app-copy";
import { referralSharePayload, referralSignupUrl } from "./share";

describe("referralSignupUrl", () => {
  it("always uses the canonical app origin, not the current host", () => {
    expect(referralSignupUrl("FD7K2P")).toBe(
      `${APP_ORIGIN}/login?ref=FD7K2P`,
    );
    expect(referralSignupUrl("FD7K2P")).not.toContain("vercel.app");
  });

  it("encodes the referral code", () => {
    expect(referralSignupUrl("FD 7K")).toBe(
      `${APP_ORIGIN}/login?ref=FD%207K`,
    );
  });
});

describe("referralSharePayload", () => {
  it("sends only title and url so Messages does not append the trial sentence", () => {
    const url = `${APP_ORIGIN}/login?ref=FDD2A4`;
    expect(referralSharePayload(url)).toEqual({
      title: "Fuel Dip Calculator",
      url,
    });
  });
});
