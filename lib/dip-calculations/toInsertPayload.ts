export type SafeFillPct = 0.9 | 0.95;

export interface DipCalculationInsertInput {
  companyId: string;
  driverId: string;
  tankTypeId: string;
  locationLabel: string | null;
  safeFillPct: SafeFillPct;
  productGrade: string | null;
  compartmentNo: string | null;
  safeFillLiters: number;
  beforeDipCm: number;
  beforeVolumeLiters: number;
  tankWillHoldLiters: number;
  plannedDeliveryLiters: number;
  afterDipCm: number;
  afterVolumeLiters: number;
  receiptVolumeLiters: number;
  volumeDifferenceLiters: number;
  divertedTo: string | null;
  newBolNo: string | null;
  litersRetained: number | null;
  driverSignature: string;
}

/** Maps form + calc results to a `dip_calculations` insert row (snake_case columns). */
export function toInsertPayload(input: DipCalculationInsertInput) {
  return {
    company_id: input.companyId,
    driver_id: input.driverId,
    tank_type_id: input.tankTypeId,
    location_label: input.locationLabel,
    safe_fill_pct: input.safeFillPct,
    product_grade: input.productGrade,
    compartment_no: input.compartmentNo,
    safe_fill_liters: input.safeFillLiters,
    before_dip_cm: input.beforeDipCm,
    before_volume_liters: input.beforeVolumeLiters,
    tank_will_hold_liters: input.tankWillHoldLiters,
    planned_delivery_liters: input.plannedDeliveryLiters,
    after_dip_cm: input.afterDipCm,
    after_volume_liters: input.afterVolumeLiters,
    receipt_volume_liters: input.receiptVolumeLiters,
    volume_difference_liters: input.volumeDifferenceLiters,
    diverted_to: input.divertedTo,
    new_bol_no: input.newBolNo,
    liters_retained: input.litersRetained,
    driver_signature: input.driverSignature,
  };
}
