import { describe, expect, it } from "vitest";
import { safeAuthCallbackNext } from "./safeNextPath";

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
    expect(safeAuthCallbackNext("/calculator/../evil")).toBe("/calculator");
    expect(safeAuthCallbackNext(null)).toBe("/calculator");
    expect(safeAuthCallbackNext(undefined)).toBe("/calculator");
    expect(safeAuthCallbackNext("")).toBe("/calculator");
  });
});
