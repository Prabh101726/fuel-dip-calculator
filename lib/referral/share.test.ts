import { describe, expect, it } from "vitest";
import { referralSignupUrl } from "./share";

describe("referralSignupUrl", () => {
  it("builds a login ref link", () => {
    expect(referralSignupUrl("https://fuel-dip-calculator.app", "FD7K2P")).toBe(
      "https://fuel-dip-calculator.app/login?ref=FD7K2P",
    );
  });

  it("strips a trailing slash on origin", () => {
    expect(referralSignupUrl("https://fuel-dip-calculator.app/", "FD7K2P")).toBe(
      "https://fuel-dip-calculator.app/login?ref=FD7K2P",
    );
  });
});
