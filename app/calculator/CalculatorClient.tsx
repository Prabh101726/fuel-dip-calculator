"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SAFETY_REMINDER } from "@/lib/app-copy";
import {
  blankSlotDraft,
  getDraft,
  getSessionMeta,
  getTankCatalog,
  isBrowserOnline,
  isTrialExpired,
  listCachedTanks,
  listOutbox,
  putDraft,
  putSessionMeta,
  putTankCatalog,
  type CalculatorDraft,
  type SlotDraft,
  type TankCatalogEntry,
} from "@/lib/offline/db";
import { flushOutbox } from "@/lib/offline/flushOutbox";
import { tankTabLabel } from "@/lib/product-grades";
import { createClient } from "@/lib/supabase/client";
import InstallHint from "./InstallHint";
import OfflineBanner from "./OfflineBanner";
import TankSlot, { type TankType } from "./TankSlot";

const SLOT_COUNT = 4;
const DRAFT_DEBOUNCE_MS = 400;

export default function CalculatorClient() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [driverId, setDriverId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [tanks, setTanks] = useState<TankType[]>([]);
  const [loadError, setLoadError] = useState("");
  const [trialBlocked, setTrialBlocked] = useState(false);
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [activeTab, setActiveTab] = useState(0);
  const [tabCharts, setTabCharts] = useState<(string | null)[]>(() =>
    Array.from({ length: SLOT_COUNT }, () => null),
  );
  const [tabProducts, setTabProducts] = useState<(string | null)[]>(() =>
    Array.from({ length: SLOT_COUNT }, () => null),
  );
  const [initialSlotDrafts, setInitialSlotDrafts] = useState<
    (SlotDraft | null)[] | null
  >(null);
  const [bootDone, setBootDone] = useState(false);

  const slotDraftsRef = useRef<SlotDraft[]>(
    Array.from({ length: SLOT_COUNT }, () => blankSlotDraft()),
  );
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeTabRef = useRef(0);

  const chartSetters = useMemo(
    () =>
      Array.from({ length: SLOT_COUNT }, (_, index) => {
        return (chartNumber: string | null) => {
          setTabCharts((prev) => {
            if (prev[index] === chartNumber) return prev;
            const next = [...prev];
            next[index] = chartNumber;
            return next;
          });
        };
      }),
    [],
  );

  const productSetters = useMemo(
    () =>
      Array.from({ length: SLOT_COUNT }, (_, index) => {
        return (productGrade: string | null) => {
          setTabProducts((prev) => {
            if (prev[index] === productGrade) return prev;
            const next = [...prev];
            next[index] = productGrade;
            return next;
          });
        };
      }),
    [],
  );

  const refreshOutboxCounts = useCallback(async () => {
    const items = await listOutbox();
    setPendingCount(items.filter((i) => i.status === "pending").length);
    setFailedCount(items.filter((i) => i.status === "failed").length);
  }, []);

  // Until boot restores IDB drafts into slotDraftsRef, persisting would
  // clobber real drafts with blanks (online boot often >400ms).
  const draftsReadyRef = useRef(false);

  const scheduleDraftPersist = useCallback(() => {
    if (!draftsReadyRef.current) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      if (!draftsReadyRef.current) return;
      void putDraft({
        activeTab: activeTabRef.current,
        slots: slotDraftsRef.current,
        updatedAt: new Date().toISOString(),
      });
    }, DRAFT_DEBOUNCE_MS);
  }, []);

  const onSlotDraftChange = useCallback(
    (index: number, draft: SlotDraft) => {
      slotDraftsRef.current[index] = draft;
      scheduleDraftPersist();
    },
    [scheduleDraftPersist],
  );

  const runFlush = useCallback(async () => {
    if (!isBrowserOnline()) return;
    await flushOutbox(supabase, {
      refreshSession: async () => {
        await supabase.auth.refreshSession();
      },
    });
    await refreshOutboxCounts();
  }, [supabase, refreshOutboxCounts]);

  useEffect(() => {
    activeTabRef.current = activeTab;
    scheduleDraftPersist();
  }, [activeTab, scheduleDraftPersist]);

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      void runFlush();
    };
    const onOffline = () => setOnline(false);
    const onFocus = () => {
      if (isBrowserOnline()) void runFlush();
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("focus", onFocus);
    };
  }, [runFlush]);

  useEffect(() => {
    let cancelled = false;

    function applyDraft(draft: CalculatorDraft | undefined) {
      if (draft?.slots?.length) {
        const slots = Array.from({ length: SLOT_COUNT }, (_, i) =>
          draft.slots[i] ?? blankSlotDraft(),
        );
        slotDraftsRef.current = slots;
        const tab =
          typeof draft.activeTab === "number" &&
          draft.activeTab >= 0 &&
          draft.activeTab < SLOT_COUNT
            ? draft.activeTab
            : 0;
        setActiveTab(tab);
        activeTabRef.current = tab;
        setTabCharts(slots.map((s) => s.chartNumber));
        setTabProducts(
          slots.map((s) =>
            s.productGrade.trim() === "" ? null : s.productGrade,
          ),
        );
        draftsReadyRef.current = true;
        setInitialSlotDrafts(slots);
      } else {
        draftsReadyRef.current = true;
        setInitialSlotDrafts(
          Array.from({ length: SLOT_COUNT }, () => blankSlotDraft()),
        );
      }
    }

    async function tanksForPaint(onlineNow: boolean): Promise<TankType[]> {
      if (onlineNow) {
        const catalog = await getTankCatalog();
        if (catalog?.tanks.length) {
          return catalog.tanks as TankType[];
        }
      }
      const cached = await listCachedTanks();
      return cached.map((c) => ({
        id: c.tankTypeId,
        chart_number: c.chart_number,
        manufacturer: c.manufacturer,
        capacity_liters: c.capacity_liters,
      }));
    }

    /** Fast path: local session + IDB. Returns true if UI can paint (or trial blocked). */
    async function paintFromCache(onlineNow: boolean): Promise<boolean> {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return false;

      const meta = await getSessionMeta();
      if (!meta) return false;

      if (isTrialExpired(meta.trialEndsAt)) {
        setTrialBlocked(true);
        setBootDone(true);
        return true;
      }

      setDriverId(meta.driverId);
      setCompanyId(meta.companyId);
      setTanks(await tanksForPaint(onlineNow));
      applyDraft(await getDraft());
      await refreshOutboxCounts();
      setBootDone(true);
      return true;
    }

    async function refreshOnline(options?: {
      requireTanks?: boolean;
    }): Promise<boolean> {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (cancelled) return false;
      if (userErr || !user) {
        router.replace("/login");
        return false;
      }

      const { data: driver, error: driverErr } = await supabase
        .from("drivers")
        .select("id, company_id")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return false;
      if (driverErr || !driver) {
        setLoadError(
          "No driver account found. Ask your admin to provision access.",
        );
        return false;
      }

      const existingMeta = await getSessionMeta();
      const { data: trialEndsAt, error: trialErr } =
        await supabase.rpc("my_trial_ends_at");
      const trial = trialErr
        ? (existingMeta?.trialEndsAt ?? null)
        : typeof trialEndsAt === "string"
          ? trialEndsAt
          : null;

      await putSessionMeta({
        driverId: driver.id,
        companyId: driver.company_id,
        trialEndsAt: trial,
        updatedAt: new Date().toISOString(),
      });

      if (cancelled) return false;
      if (isTrialExpired(trial)) {
        setTrialBlocked(true);
        return false;
      }
      setTrialBlocked(false);
      setDriverId(driver.id);
      setCompanyId(driver.company_id);

      const { data: tankRows, error: tankErr } = await supabase
        .from("tank_types")
        .select("id, chart_number, manufacturer, capacity_liters")
        .order("chart_number");

      if (cancelled) return false;
      if (tankErr) {
        if (options?.requireTanks) {
          setLoadError(tankErr.message);
        }
        return false;
      }

      const rows = (tankRows ?? []) as TankCatalogEntry[];
      setTanks(rows as TankType[]);
      await putTankCatalog(rows);
      void runFlush();
      return true;
    }

    (async () => {
      const currentlyOnline = isBrowserOnline();
      setOnline(currentlyOnline);

      try {
        const painted = await paintFromCache(currentlyOnline);
        if (cancelled) return;

        if (painted) {
          // Warm reopen: form already visible; refresh in background when online.
          if (currentlyOnline) {
            void refreshOnline().catch(() => {
              /* keep cached UI */
            });
          }
          return;
        }

        // Cold first visit (no IDB session yet)
        if (!currentlyOnline) {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (!session) {
            router.replace("/login");
            return;
          }
          setLoadError(
            "Connect once while online to use the calculator offline.",
          );
          setBootDone(true);
          return;
        }

        await refreshOnline({ requireTanks: true });
        if (cancelled) return;
        applyDraft(await getDraft());
        await refreshOutboxCounts();
        setBootDone(true);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (!currentlyOnline) {
          setLoadError(
            "Could not start offline. Connect once while online, then try again.",
          );
        } else {
          setLoadError(msg || "Failed to load calculator.");
        }
        setBootDone(true);
      }
    })();

    return () => {
      cancelled = true;
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [supabase, router, refreshOutboxCounts, runFlush]);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (trialBlocked) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-xl font-bold text-[var(--text)]">Trial ended</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Your trial has ended. Connect online and renew to keep using the
          calculator. Offline saves are disabled.
        </p>
        <Link
          href="/trial-ended"
          className="mt-6 inline-flex min-h-11 items-center font-bold text-[var(--accent)]"
        >
          View options
        </Link>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10">
        <p className="text-[var(--danger)]">{loadError}</p>
        <button
          type="button"
          onClick={() => void logout()}
          className="mt-4 min-h-11 font-bold text-[var(--accent)]"
        >
          Log out
        </button>
      </main>
    );
  }

  const ready =
    bootDone &&
    driverId !== null &&
    companyId !== null &&
    initialSlotDrafts !== null;

  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-24 pt-6">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">
            Safe discharge
          </p>
          <h1 className="text-2xl font-bold text-[var(--text)]">Tank calculator</h1>
        </div>
        <div className="flex gap-3 text-sm font-bold">
          <Link
            href="/history"
            className={`min-h-11 content-center ${
              online
                ? "text-[var(--accent)]"
                : "pointer-events-none text-[var(--muted)] opacity-50"
            }`}
            aria-disabled={!online}
            title={online ? undefined : "History requires a network connection"}
          >
            History
          </Link>
          <button
            type="button"
            onClick={() => void logout()}
            className="min-h-11 text-[var(--muted)]"
          >
            Log out
          </button>
        </div>
      </header>

      <OfflineBanner
        online={online}
        pendingCount={pendingCount}
        failedCount={failedCount}
      />
      <InstallHint />

      <p className="mb-4 rounded-lg border border-[var(--warn)] bg-[var(--warn-bg)] px-3 py-2.5 text-sm font-medium text-[var(--warn-fg)]">
        {SAFETY_REMINDER}
      </p>

      {!online && tanks.length === 0 && (
        <p className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--muted)]">
          No cached tanks yet. Open each tank once while online to use it
          offline.
        </p>
      )}

      <div className="mb-4 grid grid-cols-4 gap-2">
        {Array.from({ length: SLOT_COUNT }, (_, index) => {
          const label = tankTabLabel({
            productGrade: tabProducts[index],
            chartNumber: tabCharts[index],
            slotIndex: index,
          });
          const active = activeTab === index;
          return (
            <button
              key={index}
              type="button"
              onClick={() => setActiveTab(index)}
              className={`min-h-11 rounded-lg border px-1 text-xs font-bold ${
                active
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]"
                  : "border-[var(--border)] bg-[var(--card)] text-[var(--text)]"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {!ready ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : (
        Array.from({ length: SLOT_COUNT }, (_, index) => (
          <div
            key={index}
            className={activeTab === index ? "block" : "hidden"}
            aria-hidden={activeTab !== index}
          >
            <TankSlot
              tanks={tanks}
              driverId={driverId}
              companyId={companyId}
              supabase={supabase}
              initialDraft={initialSlotDrafts[index]}
              onDraftChange={(draft) => onSlotDraftChange(index, draft)}
              onOutboxChange={() => void refreshOutboxCounts()}
              onSelectedChartChange={chartSetters[index]}
              onSelectedProductChange={productSetters[index]}
            />
          </div>
        ))
      )}

      <footer className="mt-10 flex gap-4 text-xs font-bold text-[var(--muted)]">
        <Link href="/privacy" className="min-h-11 content-center hover:text-[var(--accent)]">
          Privacy
        </Link>
        <Link href="/terms" className="min-h-11 content-center hover:text-[var(--accent)]">
          Terms
        </Link>
      </footer>
    </main>
  );
}
