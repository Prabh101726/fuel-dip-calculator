import { describe, expect, it } from "vitest";
import {
  safeAuthCallbackNext,
  safeCheckoutCancelPath,
  safePostAuthNext,
} from "./safeNextPath";

describe("safeAuthCallbackNext", () => {
  it("allows exact calculator and history paths", () => {
    expect(safeAuthCallbackNext("/calculator")).toBe("/calculator");
    expect(safeAuthCallbackNext("/history")).toBe("/history");
  });

  it("rejects open-redirect and foreign values", () => {
    expect(safeAuthCallbackNext("@evil.com")).toBe("/calculator");
    expect(safeAuthCallbackNext("https://evil.com")).toBe("/calculator");
    expect(safeAuthCallbackNext("//evil.com")).toBe("/calculator");
    expect(safeAuthCallbackNext("/login")).toBe("/calculator");
    expect(safeAuthCallbackNext("/subscribe")).toBe("/calculator");
    expect(safeAuthCallbackNext("/calculator/../evil")).toBe("/calculator");
    expect(safeAuthCallbackNext(null)).toBe("/calculator");
    expect(safeAuthCallbackNext(undefined)).toBe("/calculator");
    expect(safeAuthCallbackNext("")).toBe("/calculator");
  });
});

describe("safePostAuthNext", () => {
  it("allows calculator, history, subscribe, and feedback", () => {
    expect(safePostAuthNext("/calculator")).toBe("/calculator");
    expect(safePostAuthNext("/history")).toBe("/history");
    expect(safePostAuthNext("/subscribe")).toBe("/subscribe");
    expect(safePostAuthNext("/feedback")).toBe("/feedback");
  });

  it("rejects open redirects", () => {
    expect(safePostAuthNext("@evil.com")).toBe("/calculator");
    expect(safePostAuthNext("/trial-ended")).toBe("/calculator");
    expect(safePostAuthNext(null)).toBe("/calculator");
  });
});

describe("safeCheckoutCancelPath", () => {
  it("allows subscribe and trial-ended", () => {
    expect(safeCheckoutCancelPath("/subscribe")).toBe("/subscribe");
    expect(safeCheckoutCancelPath("/trial-ended")).toBe("/trial-ended");
  });

  it("defaults unsafe values to trial-ended", () => {
    expect(safeCheckoutCancelPath(null)).toBe("/trial-ended");
    expect(safeCheckoutCancelPath("/calculator")).toBe("/trial-ended");
    expect(safeCheckoutCancelPath("https://evil.com")).toBe("/trial-ended");
  });
});
