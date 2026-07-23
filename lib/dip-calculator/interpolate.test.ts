import { describe, expect, it } from "vitest";
import { DipOutOfRangeError, interpolateVolume } from "./interpolate";

describe("interpolateVolume", () => {
  const points = [
    { dipCm: 100, volumeLiters: 10000 },
    { dipCm: 200, volumeLiters: 20000 },
    { dipCm: 300, volumeLiters: 32000 },
  ];

  it("returns the exact volume when the dip matches a chart point", () => {
    expect(interpolateVolume(points, 200)).toBe(20000);
  });

  it("linearly interpolates between two bracketing points", () => {
    expect(interpolateVolume(points, 150)).toBe(15000);
  });

  it("interpolates within a later, differently-sloped segment using its own bracket", () => {
    expect(interpolateVolume(points, 250)).toBe(26000);
  });

  it("throws DipOutOfRangeError below the charted range", () => {
    expect(() => interpolateVolume(points, 50)).toThrow(DipOutOfRangeError);
  });

  it("throws DipOutOfRangeError above the charted range", () => {
    expect(() => interpolateVolume(points, 350)).toThrow(DipOutOfRangeError);
  });

  it("works regardless of input ordering", () => {
    const shuffled = [points[2], points[0], points[1]];
    expect(interpolateVolume(shuffled, 150)).toBe(15000);
  });
});
