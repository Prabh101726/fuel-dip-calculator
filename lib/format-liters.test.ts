import { describe, expect, it } from "vitest";
import { formatLiters, formatSignedLiters } from "./format-liters";

describe("formatLiters", () => {
  it("formats absolute volumes without a sign prefix", () => {
    expect(formatLiters(1152)).toBe("1,152 L");
    expect(formatLiters(0)).toBe("0 L");
  });

  it("returns an em dash for missing values", () => {
    expect(formatLiters(null)).toBe("—");
    expect(formatLiters(undefined)).toBe("—");
    expect(formatLiters(Number.NaN)).toBe("—");
  });
});

describe("formatSignedLiters", () => {
  it("prefixes + when receipt exceeds planned (positive difference)", () => {
    expect(formatSignedLiters(152)).toBe("+152 L");
    expect(formatSignedLiters(1152.4)).toBe("+1,152 L");
  });

  it("keeps the minus sign for short deliveries", () => {
    expect(formatSignedLiters(-7000)).toBe("-7,000 L");
  });

  it("shows zero without a plus", () => {
    expect(formatSignedLiters(0)).toBe("0 L");
  });
});
