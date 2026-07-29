import { beforeEach, describe, expect, it } from "vitest";
import {
  blankCalculatorDraft,
  getCachedTank,
  getDraft,
  getOfflineDb,
  getSessionMeta,
  getTankCatalog,
  putCachedTank,
  putDraft,
  putSessionMeta,
  putTankCatalog,
  resetOfflineDbForTests,
} from "./db";

describe("offline IDB helpers", () => {
  beforeEach(async () => {
    resetOfflineDbForTests();
    const db = await getOfflineDb();
    await db.clear("charts");
    await db.clear("catalog");
    await db.clear("session");
    await db.clear("drafts");
    await db.clear("outbox");
  });

  it("round-trips cached tank charts", async () => {
    await putCachedTank({
      tankTypeId: "t1",
      chart_number: "526",
      manufacturer: "X",
      capacity_liters: 50000,
      points: [
        { dipCm: 0, volumeLiters: 0 },
        { dipCm: 10, volumeLiters: 100 },
      ],
      cachedAt: "2026-07-29T00:00:00.000Z",
    });
    const got = await getCachedTank("t1");
    expect(got?.chart_number).toBe("526");
    expect(got?.points).toHaveLength(2);
  });

  it("round-trips session meta and drafts", async () => {
    await putSessionMeta({
      driverId: "d1",
      companyId: "c1",
      trialEndsAt: "2099-01-01T00:00:00.000Z",
      updatedAt: "2026-07-29T00:00:00.000Z",
    });
    const meta = await getSessionMeta();
    expect(meta?.driverId).toBe("d1");

    const draft = blankCalculatorDraft(4);
    draft.activeTab = 2;
    draft.slots[0].beforeDipCm = "120";
    draft.slots[0].productGrade = "E15 Reg";
    await putDraft(draft);
    const restored = await getDraft();
    expect(restored?.activeTab).toBe(2);
    expect(restored?.slots[0].beforeDipCm).toBe("120");
    expect(restored?.slots[0].productGrade).toBe("E15 Reg");
    expect(restored?.slots).toHaveLength(4);
  });

  it("round-trips tank catalog metadata", async () => {
    await putTankCatalog([
      {
        id: "t1",
        chart_number: "015",
        manufacturer: "ZCL",
        capacity_liters: 50000,
      },
    ]);
    const catalog = await getTankCatalog();
    expect(catalog?.tanks).toHaveLength(1);
    expect(catalog?.tanks[0].chart_number).toBe("015");
  });
});
