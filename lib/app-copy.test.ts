import { describe, expect, it } from "vitest";
import {
  CONTACT_EMAIL,
  MONTHLY_PRICE_CAD,
  MONTHLY_PRICE_LABEL,
  SAFETY_REMINDER,
  TRIAL_DAYS,
  authCallbackUrl,
  resetPasswordUrl,
} from "./app-copy";

describe("app-copy", () => {
  it("locks contact, safety, trial length, and price", () => {
    expect(CONTACT_EMAIL).toBe("contact@detours-app.com");
    expect(SAFETY_REMINDER).toBe(
      "Safety first: always verify the physical tank tag matches the chart number and given site plan Tank charts before delivery.",
    );
    expect(TRIAL_DAYS).toBe(7);
    expect(MONTHLY_PRICE_CAD).toBe(2.99);
    expect(MONTHLY_PRICE_LABEL).toBe("$2.99 CAD/month per driver");
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
