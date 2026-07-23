import type { DipChartPoint } from "./types";

export class DipOutOfRangeError extends Error {
  constructor(dipCm: number, minCm: number, maxCm: number) {
    super(`Dip ${dipCm}cm is outside the charted range ${minCm}cm-${maxCm}cm`);
    this.name = "DipOutOfRangeError";
  }
}

export function interpolateVolume(points: DipChartPoint[], dipCm: number): number {
  if (points.length === 0) {
    throw new Error("interpolateVolume: points array is empty");
  }

  const sorted = [...points].sort((a, b) => a.dipCm - b.dipCm);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  if (dipCm < min.dipCm || dipCm > max.dipCm) {
    throw new DipOutOfRangeError(dipCm, min.dipCm, max.dipCm);
  }

  const exact = sorted.find((p) => p.dipCm === dipCm);
  if (exact) {
    return exact.volumeLiters;
  }

  let lower = sorted[0];
  let upper = sorted[sorted.length - 1];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].dipCm < dipCm && sorted[i + 1].dipCm > dipCm) {
      lower = sorted[i];
      upper = sorted[i + 1];
      break;
    }
  }

  const ratio = (dipCm - lower.dipCm) / (upper.dipCm - lower.dipCm);
  return lower.volumeLiters + ratio * (upper.volumeLiters - lower.volumeLiters);
}
