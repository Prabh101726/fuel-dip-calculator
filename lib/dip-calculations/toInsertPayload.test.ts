import { describe, expect, it } from "vitest";
import { toInsertPayload } from "./toInsertPayload";

describe("toInsertPayload", () => {
  it("maps camelCase calc fields to dip_calculations column names", () => {
    const row = toInsertPayload({
      companyId: "c1",
      driverId: "d1",
      tankTypeId: "t1",
      locationLabel: "Site A",
      safeFillPct: 0.9,
      productGrade: "Diesel LSD",
      compartmentNo: "1",
      safeFillLiters: 45000,
      beforeDipCm: 174,
      beforeVolumeLiters: 38360,
      tankWillHoldLiters: 6640,
      plannedDeliveryLiters: 4000,
      afterDipCm: 194,
      afterVolumeLiters: 42700,
      receiptVolumeLiters: 4340,
      volumeDifferenceLiters: 340,
      divertedTo: null,
      newBolNo: null,
      litersRetained: null,
      driverSignature: "Pat Driver",
    });

    expect(row).toEqual({
      company_id: "c1",
      driver_id: "d1",
      tank_type_id: "t1",
      location_label: "Site A",
      safe_fill_pct: 0.9,
      product_grade: "Diesel LSD",
      compartment_no: "1",
      safe_fill_liters: 45000,
      before_dip_cm: 174,
      before_volume_liters: 38360,
      tank_will_hold_liters: 6640,
      planned_delivery_liters: 4000,
      after_dip_cm: 194,
      after_volume_liters: 42700,
      receipt_volume_liters: 4340,
      volume_difference_liters: 340,
      diverted_to: null,
      new_bol_no: null,
      liters_retained: null,
      driver_signature: "Pat Driver",
    });
  });
});
