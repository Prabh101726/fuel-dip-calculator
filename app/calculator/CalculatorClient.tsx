"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import TankSlot, { type TankType } from "./TankSlot";

const SLOT_COUNT = 4;

export default function CalculatorClient() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [driverId, setDriverId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [tanks, setTanks] = useState<TankType[]>([]);
  const [loadError, setLoadError] = useState("");
  const [activeTab, setActiveTab] = useState(0);
  const [tabCharts, setTabCharts] = useState<(string | null)[]>(() =>
    Array.from({ length: SLOT_COUNT }, () => null),
  );

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: driver, error: driverErr } = await supabase
        .from("drivers")
        .select("id, company_id")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;
      if (driverErr || !driver) {
        setLoadError(
          "No driver account found. Ask your admin to provision access.",
        );
        return;
      }
      setDriverId(driver.id);
      setCompanyId(driver.company_id);

      const { data: tankRows, error: tankErr } = await supabase
        .from("tank_types")
        .select("id, chart_number, manufacturer, capacity_liters")
        .order("chart_number");

      if (cancelled) return;
      if (tankErr) {
        setLoadError(tankErr.message);
        return;
      }
      setTanks((tankRows ?? []) as TankType[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, router]);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
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

  const ready = driverId !== null && companyId !== null;

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
          <Link href="/history" className="min-h-11 content-center text-[var(--accent)]">
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

      <div className="mb-4 grid grid-cols-4 gap-2">
        {Array.from({ length: SLOT_COUNT }, (_, index) => {
          const chart = tabCharts[index];
          const label = chart ? `#${chart}` : `Tank ${index + 1}`;
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
              onSelectedChartChange={chartSetters[index]}
            />
          </div>
        ))
      )}
    </main>
  );
}
