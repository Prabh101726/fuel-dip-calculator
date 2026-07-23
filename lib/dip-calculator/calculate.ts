import { interpolateVolume } from "./interpolate";
import type { DipChartPoint } from "./types";

export interface BeforeDeliveryInput {
  tankPoints: DipChartPoint[];
  capacityLiters: number;
  safeFillPct: number;
  beforeDipCm: number;
  plannedDeliveryLiters: number;
}

export interface BeforeDeliveryResult {
  safeFillLiters: number; // #1
  beforeVolumeLiters: number; // #2
  tankWillHoldLiters: number; // #3
  overfillWarning: boolean; // planned delivery (#4) >= #3
}

export function calculateBeforeDelivery(input: BeforeDeliveryInput): BeforeDeliveryResult {
  const safeFillLiters = input.capacityLiters * input.safeFillPct;
  const beforeVolumeLiters = interpolateVolume(input.tankPoints, input.beforeDipCm);
  const tankWillHoldLiters = safeFillLiters - beforeVolumeLiters;
  const overfillWarning = input.plannedDeliveryLiters >= tankWillHoldLiters;

  return { safeFillLiters, beforeVolumeLiters, tankWillHoldLiters, overfillWarning };
}

export interface AfterDeliveryInput {
  tankPoints: DipChartPoint[];
  safeFillLiters: number;
  beforeDipCm: number;
  beforeVolumeLiters: number;
  plannedDeliveryLiters: number;
  afterDipCm: number;
}

export interface AfterDeliveryResult {
  afterVolumeLiters: number; // #5
  receiptVolumeLiters: number; // #6 = #5 - #2
  volumeDifferenceLiters: number; // #7 = #6 - #4
  reversedDipWarning: boolean; // after dip < before dip
  overfillWarning: boolean; // actual after-volume exceeds the safe-fill limit
}

export function calculateAfterDelivery(input: AfterDeliveryInput): AfterDeliveryResult {
  const reversedDipWarning = input.afterDipCm < input.beforeDipCm;
  const afterVolumeLiters = interpolateVolume(input.tankPoints, input.afterDipCm);
  const receiptVolumeLiters = afterVolumeLiters - input.beforeVolumeLiters;
  const volumeDifferenceLiters = receiptVolumeLiters - input.plannedDeliveryLiters;
  const overfillWarning = afterVolumeLiters > input.safeFillLiters;

  return {
    afterVolumeLiters,
    receiptVolumeLiters,
    volumeDifferenceLiters,
    reversedDipWarning,
    overfillWarning,
  };
}
