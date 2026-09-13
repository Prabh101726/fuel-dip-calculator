import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { isAccessActive } from "@/lib/billing/access";
import type { DipChartPoint } from "@/lib/dip-calculator/types";
import type { SafeFillPct } from "@/lib/dip-calculations/toInsertPayload";

const DB_NAME = "fuel-dip-offline";
const DB_VERSION = 2;

export type CachedTankChart = {
  tankTypeId: string;
  chart_number: string;
  manufacturer: string;
  capacity_liters: number;
  points: DipChartPoint[];
  cachedAt: string;
};

/** Full tank_types metadata for fast online reopen (no dip points). */
export type TankCatalogEntry = {
  id: string;
  chart_number: string;
  manufacturer: string;
  capacity_liters: number;
};

export type TankCatalog = {
  id: "current";
  tanks: TankCatalogEntry[];
  updatedAt: string;
};

export type OfflineSessionMeta = {
  id: "current";
  driverId: string;
  companyId: string;
  trialEndsAt: string | null;
  /** This driver's Stripe subscription.status; null if never subscribed / unknown. */
  subscriptionStatus: string | null;
  updatedAt: string;
};

export type SlotDraft = {
  tankTypeId: string | null;
  chartNumber: string | null;
  productGrade: string;
  safeFillPct: SafeFillPct;
  locationLabel: string;
  beforeDipCm: string;
  plannedDeliveryLiters: string;
  afterDipCm: string;
  divertedTo: string;
  newBolNo: string;
  litersRetained: string;
  driverSignature: string;
};

export type CalculatorDraft = {
  id: "current";
  activeTab: number;
  slots: SlotDraft[];
  updatedAt: string;
};

export type OutboxStatus = "pending" | "failed";

export type OutboxItem = {
  id: string;
  payload: Record<string, unknown>;
  createdAt: string;
  status: OutboxStatus;
  lastError: string | null;
};

interface FuelDipOfflineDb extends DBSchema {
  charts: {
    key: string;
    value: CachedTankChart;
  };
  catalog: {
    key: string;
    value: TankCatalog;
  };
  session: {
    key: string;
    value: OfflineSessionMeta;
  };
  drafts: {
    key: string;
    value: CalculatorDraft;
  };
  outbox: {
    key: string;
    value: OutboxItem;
    indexes: { "by-created": string };
  };
}

let dbPromise: Promise<IDBPDatabase<FuelDipOfflineDb>> | null = null;

function dropOfflineDbHandle() {
  dbPromise = null;
}

/** Safari closes IDB under memory pressure / PWA suspend; reopen once. */
export function isIdbConnectionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (/database connection is closing/i.test(msg)) return true;
  if (/Indexed Database server/i.test(msg)) return true;
  if (/not allowed or at a time when it is not allowed/i.test(msg)) return true;
  // Safari + fake-indexeddb both surface closed handles as InvalidStateError /
  // UnknownError DOMExceptions without a stable message across engines.
  if (
    typeof DOMException !== "undefined" &&
    err instanceof DOMException &&
    (err.name === "InvalidStateError" || err.name === "UnknownError")
  ) {
    return true;
  }
  return false;
}

function attachDbLifecycle(db: IDBPDatabase<FuelDipOfflineDb>) {
  const raw = db as unknown as IDBDatabase;
  raw.onclose = () => {
    dropOfflineDbHandle();
  };
  raw.onversionchange = () => {
    dropOfflineDbHandle();
    try {
      db.close();
    } catch {
      // already closing
    }
  };
}

export function getOfflineDb() {
  if (!dbPromise) {
    dbPromise = openDB<FuelDipOfflineDb>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore("charts", { keyPath: "tankTypeId" });
          db.createObjectStore("session", { keyPath: "id" });
          db.createObjectStore("drafts", { keyPath: "id" });
          const outbox = db.createObjectStore("outbox", { keyPath: "id" });
          outbox.createIndex("by-created", "createdAt");
        }
        if (oldVersion < 2) {
          db.createObjectStore("catalog", { keyPath: "id" });
        }
      },
    }).then((db) => {
      attachDbLifecycle(db);
      return db;
    });
  }
  return dbPromise;
}

/** Run an IDB op; if Safari closed the connection, reopen and retry once. */
export async function withOfflineDb<T>(
  op: (db: IDBPDatabase<FuelDipOfflineDb>) => Promise<T>,
): Promise<T> {
  try {
    const db = await getOfflineDb();
    return await op(db);
  } catch (err) {
    if (!isIdbConnectionError(err)) throw err;
    dropOfflineDbHandle();
    const db = await getOfflineDb();
    return await op(db);
  }
}

/** Test helper — reset module DB handle between tests. */
export function resetOfflineDbForTests() {
  dbPromise = null;
}

export function isBrowserOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

export async function putCachedTank(chart: CachedTankChart): Promise<void> {
  await withOfflineDb((db) => db.put("charts", chart));
}

export async function getCachedTank(
  tankTypeId: string,
): Promise<CachedTankChart | undefined> {
  return withOfflineDb((db) => db.get("charts", tankTypeId));
}

export async function listCachedTanks(): Promise<CachedTankChart[]> {
  return withOfflineDb((db) => db.getAll("charts"));
}

export async function putTankCatalog(tanks: TankCatalogEntry[]): Promise<void> {
  await withOfflineDb((db) =>
    db.put("catalog", {
      id: "current",
      tanks,
      updatedAt: new Date().toISOString(),
    }),
  );
}

export async function getTankCatalog(): Promise<TankCatalog | undefined> {
  return withOfflineDb((db) => db.get("catalog", "current"));
}

export async function putSessionMeta(
  meta: Omit<OfflineSessionMeta, "id">,
): Promise<void> {
  await withOfflineDb((db) =>
    db.put("session", { ...meta, id: "current" }),
  );
}

export async function getSessionMeta(): Promise<OfflineSessionMeta | undefined> {
  return withOfflineDb((db) => db.get("session", "current"));
}

export async function putDraft(draft: Omit<CalculatorDraft, "id">): Promise<void> {
  await withOfflineDb((db) =>
    db.put("drafts", { ...draft, id: "current" }),
  );
}

export async function getDraft(): Promise<CalculatorDraft | undefined> {
  return withOfflineDb((db) => db.get("drafts", "current"));
}

export async function clearDraft(): Promise<void> {
  await withOfflineDb((db) => db.delete("drafts", "current"));
}

/** Clears per-driver offline state on logout (keeps shared tank chart cache). */
export async function clearOfflineUserData(): Promise<void> {
  await withOfflineDb(async (db) => {
    await db.delete("session", "current");
    await db.delete("drafts", "current");
    await db.clear("outbox");
  });
}

export async function enqueueOutbox(
  payload: Record<string, unknown>,
): Promise<OutboxItem> {
  return withOfflineDb(async (db) => {
    const item: OutboxItem = {
      id: crypto.randomUUID(),
      payload,
      createdAt: new Date().toISOString(),
      status: "pending",
      lastError: null,
    };
    await db.put("outbox", item);
    return item;
  });
}

export async function listOutbox(): Promise<OutboxItem[]> {
  return withOfflineDb((db) => db.getAllFromIndex("outbox", "by-created"));
}

export async function countPendingOutbox(): Promise<number> {
  const items = await listOutbox();
  return items.filter((i) => i.status === "pending").length;
}

export async function deleteOutboxItem(id: string): Promise<void> {
  await withOfflineDb((db) => db.delete("outbox", id));
}

export async function markOutboxFailed(
  id: string,
  lastError: string,
): Promise<void> {
  await withOfflineDb(async (db) => {
    const item = await db.get("outbox", id);
    if (!item) return;
    await db.put("outbox", {
      ...item,
      status: "failed",
      lastError,
    });
  });
}

export function isNetworkLikeError(err: unknown): boolean {
  if (!isBrowserOnline()) return true;
  if (err instanceof TypeError) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /network|fetch|offline|Failed to fetch|timeout/i.test(msg);
}

export function isAuthErrorStatus(status: number | undefined): boolean {
  return status === 401 || status === 403;
}

export function isClientRejectStatus(status: number | undefined): boolean {
  return typeof status === "number" && status >= 400 && status < 500;
}

export function blankSlotDraft(): SlotDraft {
  return {
    tankTypeId: null,
    chartNumber: null,
    productGrade: "",
    safeFillPct: 0.9,
    locationLabel: "",
    beforeDipCm: "",
    plannedDeliveryLiters: "",
    afterDipCm: "",
    divertedTo: "",
    newBolNo: "",
    litersRetained: "",
    driverSignature: "",
  };
}

export function blankCalculatorDraft(slotCount = 4): Omit<CalculatorDraft, "id"> {
  return {
    activeTab: 0,
    slots: Array.from({ length: slotCount }, () => blankSlotDraft()),
    updatedAt: new Date().toISOString(),
  };
}

export function isTrialExpired(trialEndsAt: string | null | undefined): boolean {
  if (!trialEndsAt) return false;
  const ends = new Date(trialEndsAt).getTime();
  if (Number.isNaN(ends)) return false;
  return ends <= Date.now();
}

/** Offline gate: blocked when trial ended and this driver has no paying status. */
export function isOfflineAccessBlocked(
  meta: Pick<OfflineSessionMeta, "trialEndsAt" | "subscriptionStatus"> | null | undefined,
): boolean {
  if (!meta) return true;
  return !isAccessActive({
    trialEndsAt: meta.trialEndsAt,
    subscriptionStatus: meta.subscriptionStatus,
  });
}
