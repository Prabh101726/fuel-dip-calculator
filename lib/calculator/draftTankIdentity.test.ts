import { describe, expect, it } from "vitest";
import { draftTankIdentity } from "./draftTankIdentity";

describe("draftTankIdentity", () => {
  it("uses selected tank when present", () => {
    expect(
      draftTankIdentity({
        selectedTank: { id: "t2", chart_number: "015" },
        seedTankTypeId: "t1",
        seedChartNumber: "526",
        tankCleared: false,
      }),
    ).toEqual({ tankTypeId: "t2", chartNumber: "015" });
  });

  it("falls back to seed before clear (boot restore)", () => {
    expect(
      draftTankIdentity({
        selectedTank: null,
        seedTankTypeId: "t1",
        seedChartNumber: "526",
        tankCleared: false,
      }),
    ).toEqual({ tankTypeId: "t1", chartNumber: "526" });
  });

  it("does not resurrect seed after clear", () => {
    expect(
      draftTankIdentity({
        selectedTank: null,
        seedTankTypeId: "t1",
        seedChartNumber: "526",
        tankCleared: true,
      }),
    ).toEqual({ tankTypeId: null, chartNumber: null });
  });
});
