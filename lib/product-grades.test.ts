import { describe, expect, it } from "vitest";
import { PRODUCT_GRADES, tankTabLabel } from "./product-grades";

describe("PRODUCT_GRADES", () => {
  it("locks the eight driver product options", () => {
    expect([...PRODUCT_GRADES]).toEqual([
      "E15 Reg",
      "E10 Reg",
      "P93",
      "P91",
      "PE10",
      "U94",
      "LSD Clear",
      "LSD Dyed",
    ]);
  });
});

describe("tankTabLabel", () => {
  it("prefers product grade when set", () => {
    expect(
      tankTabLabel({
        productGrade: "E15 Reg",
        chartNumber: "526",
        slotIndex: 0,
      }),
    ).toBe("E15 Reg");
  });

  it("falls back to chart number when no product", () => {
    expect(
      tankTabLabel({
        productGrade: "",
        chartNumber: "526",
        slotIndex: 0,
      }),
    ).toBe("#526");
  });

  it("falls back to Tank N when nothing selected", () => {
    expect(
      tankTabLabel({
        productGrade: null,
        chartNumber: null,
        slotIndex: 2,
      }),
    ).toBe("Tank 3");
  });
});
