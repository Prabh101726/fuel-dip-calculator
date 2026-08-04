import { describe, expect, it } from "vitest";
import {
  cleanPhoneDigits,
  formatNanpDisplay,
  normalizePhone,
  toNanpE164,
} from "./phone";

describe("cleanPhoneDigits", () => {
  it("strips spaces dashes parens", () => {
    expect(cleanPhoneDigits("+1 (416) 555-0100")).toBe("+14165550100");
  });
});

describe("normalizePhone", () => {
  it("prefixes 10-digit NANP with +1", () => {
    expect(normalizePhone("4165550100")).toBe("+14165550100");
  });

  it("keeps E.164 with plus", () => {
    expect(normalizePhone("+1 (416) 555-0100")).toBe("+14165550100");
  });

  it("handles 11-digit starting with 1", () => {
    expect(normalizePhone("14165550100")).toBe("+14165550100");
  });
});

describe("toNanpE164", () => {
  it("accepts valid +1 NANP", () => {
    expect(toNanpE164("(416) 555-0100")).toBe("+14165550100");
    expect(toNanpE164("+14165550100")).toBe("+14165550100");
  });

  it("rejects non-+1 country codes", () => {
    expect(toNanpE164("+442071838750")).toBeNull();
  });

  it("rejects short or incomplete numbers", () => {
    expect(toNanpE164("416555")).toBeNull();
    expect(toNanpE164("")).toBeNull();
  });

  it("rejects area codes starting with 0 or 1", () => {
    expect(toNanpE164("0165550100")).toBeNull();
    expect(toNanpE164("1165550100")).toBeNull();
  });
});

describe("formatNanpDisplay", () => {
  it("formats E.164 as (XXX) XXX-XXXX", () => {
    expect(formatNanpDisplay("+14165550100")).toBe("(416) 555-0100");
  });
});
