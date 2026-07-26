import { describe, expect, it } from "vitest";
import {
  CONTACT_EMAIL,
  SAFETY_REMINDER,
  TRIAL_DAYS,
  authCallbackUrl,
  resetPasswordUrl,
} from "./app-copy";

describe("app-copy", () => {
  it("locks contact, safety, and trial length", () => {
    expect(CONTACT_EMAIL).toBe("contact@detours-app.com");
    expect(SAFETY_REMINDER).toContain("tank tag");
    expect(TRIAL_DAYS).toBe(7);
  });

  it("builds auth redirect URLs without trailing junk", () => {
    expect(authCallbackUrl("https://fuel-dip-calculator.vercel.app")).toBe(
      "https://fuel-dip-calculator.vercel.app/auth/callback",
    );
    expect(resetPasswordUrl("https://fuel-dip-calculator.vercel.app")).toBe(
      "https://fuel-dip-calculator.vercel.app/auth/reset-password",
    );
  });
});
