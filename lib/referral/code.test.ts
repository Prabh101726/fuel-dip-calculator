import { describe, expect, it } from "vitest";
import {
  generateReferralCode,
  isValidReferralCode,
  normalizeReferralCode,
} from "./code";

describe("referral codes", () => {
  it("normalizes and accepts FD + 4 alphabet chars", () => {
    expect(normalizeReferralCode(" fd-7k2p ")).toBe("FD7K2P");
    expect(isValidReferralCode("FD7K2P")).toBe(true);
  });

  it("rejects self-looking junk", () => {
    expect(isValidReferralCode("")).toBe(false);
    expect(isValidReferralCode("HELLO")).toBe(false);
    expect(isValidReferralCode("FD0000")).toBe(false);
  });

  it("generates FD + 4 chars from the alphabet", () => {
    let i = 0;
    const seq = [0, 1, 2, 3];
    const code = generateReferralCode(() => seq[i++] ?? 0);
    expect(code).toMatch(/^FD[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
    expect(isValidReferralCode(code)).toBe(true);
  });
});
