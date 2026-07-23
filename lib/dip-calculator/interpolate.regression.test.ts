// lib/dip-calculator/interpolate.regression.test.ts
import { describe, expect, it } from "vitest";
import { interpolateVolume } from "./interpolate";

describe("interpolateVolume: real dip-chart regression fixtures", () => {
  it("tank #015 (50,000 L, ZCL FRP): opening 174cm -> closing 194cm", () => {
    const points = [
      { dipCm: 170, volumeLiters: 37253 },
      { dipCm: 172, volumeLiters: 37733 },
      { dipCm: 174, volumeLiters: 38209 },
      { dipCm: 176, volumeLiters: 38681 },
      { dipCm: 178, volumeLiters: 39148 },
      { dipCm: 180, volumeLiters: 39609 },
      { dipCm: 190, volumeLiters: 41837 },
      { dipCm: 192, volumeLiters: 42264 },
      { dipCm: 194, volumeLiters: 42685 },
      { dipCm: 196, volumeLiters: 43099 },
      { dipCm: 198, volumeLiters: 43506 },
      { dipCm: 200, volumeLiters: 43906 },
    ];
    const before = interpolateVolume(points, 174);
    const after = interpolateVolume(points, 194);
    expect(before).toBe(38209);
    expect(after).toBe(42685);
    expect(after - before).toBe(4476);
  });

  it("tank #014 (35,000 L, ZCL FRP): opening 154cm -> closing 196cm", () => {
    const points = [
      { dipCm: 150, volumeLiters: 22632 },
      { dipCm: 152, volumeLiters: 22995 },
      { dipCm: 154, volumeLiters: 23356 },
      { dipCm: 156, volumeLiters: 23715 },
      { dipCm: 158, volumeLiters: 24072 },
      { dipCm: 160, volumeLiters: 24427 },
      { dipCm: 190, volumeLiters: 29379 },
      { dipCm: 192, volumeLiters: 29678 },
      { dipCm: 194, volumeLiters: 29972 },
      { dipCm: 196, volumeLiters: 30260 },
      { dipCm: 198, volumeLiters: 30544 },
      { dipCm: 200, volumeLiters: 30822 },
    ];
    const before = interpolateVolume(points, 154);
    const after = interpolateVolume(points, 196);
    expect(before).toBe(23356);
    expect(after).toBe(30260);
    expect(after - before).toBe(6904);
  });

  it("tank #526 (46,540 L, CAE Fiberglass): opening 116cm -> closing 172cm", () => {
    const points = [
      { dipCm: 112, volumeLiters: 21883 },
      { dipCm: 114, volumeLiters: 22390 },
      { dipCm: 116, volumeLiters: 22897 },
      { dipCm: 118, volumeLiters: 23404 },
      { dipCm: 120, volumeLiters: 23911 },
      { dipCm: 122, volumeLiters: 24417 },
      { dipCm: 168, volumeLiters: 35657 },
      { dipCm: 170, volumeLiters: 36111 },
      { dipCm: 172, volumeLiters: 36560 },
      { dipCm: 174, volumeLiters: 37005 },
      { dipCm: 176, volumeLiters: 37445 },
      { dipCm: 178, volumeLiters: 37880 },
    ];
    const before = interpolateVolume(points, 116);
    const after = interpolateVolume(points, 172);
    expect(before).toBe(22897);
    expect(after).toBe(36560);
    expect(after - before).toBe(13663);
  });
});
