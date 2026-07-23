import { describe, expect, it } from "vitest";
import { calculateAfterDelivery, calculateBeforeDelivery } from "./calculate";

describe("calculateBeforeDelivery", () => {
  const tankPoints = [
    { dipCm: 100, volumeLiters: 10000 },
    { dipCm: 200, volumeLiters: 20000 },
    { dipCm: 300, volumeLiters: 30000 },
  ];

  it("computes the #1-#3 fields from capacity, safe-fill %, and before dip", () => {
    const result = calculateBeforeDelivery({
      tankPoints,
      capacityLiters: 50000,
      safeFillPct: 0.9,
      beforeDipCm: 150,
      plannedDeliveryLiters: 12000,
    });
    expect(result.safeFillLiters).toBe(45000); // #1
    expect(result.beforeVolumeLiters).toBe(15000); // #2
    expect(result.tankWillHoldLiters).toBe(30000); // #3
    expect(result.overfillWarning).toBe(false);
  });

  it("warns when the planned delivery would meet or exceed the tank's remaining capacity", () => {
    const result = calculateBeforeDelivery({
      tankPoints,
      capacityLiters: 50000,
      safeFillPct: 0.9,
      beforeDipCm: 150,
      plannedDeliveryLiters: 30000,
    });
    expect(result.overfillWarning).toBe(true);
  });
});

describe("calculateAfterDelivery", () => {
  const tankPoints = [
    { dipCm: 100, volumeLiters: 10000 },
    { dipCm: 200, volumeLiters: 20000 },
    { dipCm: 300, volumeLiters: 30000 },
  ];

  it("computes the #5-#7 fields from the after dip", () => {
    const result = calculateAfterDelivery({
      tankPoints,
      safeFillLiters: 45000,
      beforeDipCm: 150,
      beforeVolumeLiters: 15000,
      plannedDeliveryLiters: 12000,
      afterDipCm: 200,
    });
    expect(result.afterVolumeLiters).toBe(20000); // #5
    expect(result.receiptVolumeLiters).toBe(5000); // #6 = #5 - #2
    expect(result.volumeDifferenceLiters).toBe(-7000); // #7 = #6 - #4
    expect(result.reversedDipWarning).toBe(false);
    expect(result.overfillWarning).toBe(false);
  });

  it("flags a reversed dip when the after dip is less than the before dip", () => {
    const result = calculateAfterDelivery({
      tankPoints,
      safeFillLiters: 45000,
      beforeDipCm: 200,
      beforeVolumeLiters: 20000,
      plannedDeliveryLiters: 5000,
      afterDipCm: 150,
    });
    expect(result.reversedDipWarning).toBe(true);
  });

  it("flags an overfill when the actual after-volume exceeds the safe-fill limit", () => {
    const result = calculateAfterDelivery({
      tankPoints,
      safeFillLiters: 25000,
      beforeDipCm: 100,
      beforeVolumeLiters: 10000,
      plannedDeliveryLiters: 15000,
      afterDipCm: 300,
    });
    expect(result.overfillWarning).toBe(true);
  });
});
