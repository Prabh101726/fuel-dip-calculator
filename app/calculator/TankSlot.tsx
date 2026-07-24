"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  calculateAfterDelivery,
  calculateBeforeDelivery,
  type AfterDeliveryResult,
  type BeforeDeliveryResult,
} from "@/lib/dip-calculator/calculate";
import { DipOutOfRangeError } from "@/lib/dip-calculator/interpolate";
import type { DipChartPoint } from "@/lib/dip-calculator/types";
import {
  toInsertPayload,
  type SafeFillPct,
} from "@/lib/dip-calculations/toInsertPayload";

export type TankType = {
  id: string;
  chart_number: string;
  manufacturer: string;
  capacity_liters: number;
};

type Props = {
  tanks: TankType[];
  driverId: string;
  companyId: string;
  supabase: SupabaseClient;
  onSelectedChartChange: (chartNumber: string | null) => void;
};

function formatLiters(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Math.round(n).toLocaleString("en-CA")} L`;
}

function emptyToNull(s: string): string | null {
  const t = s.trim();
  return t === "" ? null : t;
}

function tryBefore(
  tankPoints: DipChartPoint[],
  capacityLiters: number,
  safeFillPct: SafeFillPct,
  beforeDipCm: number,
  plannedDeliveryLiters: number,
): { result: BeforeDeliveryResult | null; error: string } {
  try {
    return {
      result: calculateBeforeDelivery({
        tankPoints,
        capacityLiters,
        safeFillPct,
        beforeDipCm,
        plannedDeliveryLiters,
      }),
      error: "",
    };
  } catch (err) {
    if (err instanceof DipOutOfRangeError) {
      return { result: null, error: err.message };
    }
    return { result: null, error: "Could not calculate before-delivery volumes." };
  }
}

function tryAfter(
  tankPoints: DipChartPoint[],
  safeFillLiters: number,
  beforeDipCm: number,
  beforeVolumeLiters: number,
  plannedDeliveryLiters: number,
  afterDipCm: number,
): { result: AfterDeliveryResult | null; error: string } {
  try {
    return {
      result: calculateAfterDelivery({
        tankPoints,
        safeFillLiters,
        beforeDipCm,
        beforeVolumeLiters,
        plannedDeliveryLiters,
        afterDipCm,
      }),
      error: "",
    };
  } catch (err) {
    if (err instanceof DipOutOfRangeError) {
      return { result: null, error: err.message };
    }
    return { result: null, error: "Could not calculate after-delivery volumes." };
  }
}

export default function TankSlot({
  tanks,
  driverId,
  companyId,
  supabase,
  onSelectedChartChange,
}: Props) {
  const [tankQuery, setTankQuery] = useState("");
  const [selectedTank, setSelectedTank] = useState<TankType | null>(null);
  const [tankPoints, setTankPoints] = useState<DipChartPoint[]>([]);
  const [pointsLoading, setPointsLoading] = useState(false);
  const [pointsError, setPointsError] = useState("");

  const [safeFillPct, setSafeFillPct] = useState<SafeFillPct>(0.9);
  const [locationLabel, setLocationLabel] = useState("");
  const [productGrade, setProductGrade] = useState("");
  const [compartmentNo, setCompartmentNo] = useState("");
  const [beforeDipCm, setBeforeDipCm] = useState("");
  const [plannedDeliveryLiters, setPlannedDeliveryLiters] = useState("");
  const [afterDipCm, setAfterDipCm] = useState("");
  const [divertedTo, setDivertedTo] = useState("");
  const [newBolNo, setNewBolNo] = useState("");
  const [litersRetained, setLitersRetained] = useState("");
  const [driverSignature, setDriverSignature] = useState("");

  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (!savedFlash) return;
    const t = setTimeout(() => setSavedFlash(false), 2500);
    return () => clearTimeout(t);
  }, [savedFlash]);

  function resetSlot() {
    setTankQuery("");
    setSelectedTank(null);
    setTankPoints([]);
    setPointsLoading(false);
    setPointsError("");
    setSafeFillPct(0.9);
    setLocationLabel("");
    setProductGrade("");
    setCompartmentNo("");
    setBeforeDipCm("");
    setPlannedDeliveryLiters("");
    setAfterDipCm("");
    setDivertedTo("");
    setNewBolNo("");
    setLitersRetained("");
    setDriverSignature("");
    setSaveError("");
    setSaving(false);
    onSelectedChartChange(null);
  }

  async function selectTank(tank: TankType) {
    setSelectedTank(tank);
    onSelectedChartChange(tank.chart_number);
    setTankQuery("");
    setTankPoints([]);
    setPointsError("");
    setPointsLoading(true);
    const { data, error } = await supabase
      .from("dip_chart_points")
      .select("dip_cm, volume_liters")
      .eq("tank_type_id", tank.id)
      .order("dip_cm");
    setPointsLoading(false);
    if (error) {
      setPointsError(error.message);
      setTankPoints([]);
      return;
    }
    setTankPoints(
      (data ?? []).map((r) => ({
        dipCm: Number(r.dip_cm),
        volumeLiters: Number(r.volume_liters),
      })),
    );
  }

  function clearSelectedTankOnly() {
    setSelectedTank(null);
    onSelectedChartChange(null);
    setTankPoints([]);
    setPointsError("");
    setPointsLoading(false);
  }

  const beforeDip = Number(beforeDipCm);
  const planned = Number(plannedDeliveryLiters);
  const afterDip = Number(afterDipCm);

  const beforeCalc = useMemo(() => {
    if (!selectedTank || tankPoints.length === 0) {
      return { result: null as BeforeDeliveryResult | null, error: "" };
    }
    if (!Number.isFinite(beforeDip) || beforeDipCm.trim() === "") {
      return { result: null, error: "" };
    }
    const plannedVal =
      plannedDeliveryLiters.trim() === "" || !Number.isFinite(planned)
        ? 0
        : planned;
    return tryBefore(
      tankPoints,
      Number(selectedTank.capacity_liters),
      safeFillPct,
      beforeDip,
      plannedVal,
    );
  }, [
    selectedTank,
    tankPoints,
    beforeDip,
    beforeDipCm,
    planned,
    plannedDeliveryLiters,
    safeFillPct,
  ]);

  const afterCalc = useMemo(() => {
    if (!beforeCalc.result || tankPoints.length === 0) {
      return { result: null as AfterDeliveryResult | null, error: "" };
    }
    if (!Number.isFinite(afterDip) || afterDipCm.trim() === "") {
      return { result: null, error: "" };
    }
    const plannedVal =
      plannedDeliveryLiters.trim() === "" || !Number.isFinite(planned)
        ? 0
        : planned;
    return tryAfter(
      tankPoints,
      beforeCalc.result.safeFillLiters,
      beforeDip,
      beforeCalc.result.beforeVolumeLiters,
      plannedVal,
      afterDip,
    );
  }, [
    afterDip,
    afterDipCm,
    beforeCalc.result,
    beforeDip,
    planned,
    plannedDeliveryLiters,
    tankPoints,
  ]);

  const dipError = beforeCalc.error || afterCalc.error;
  const beforeResult = beforeCalc.result;
  const afterResult = afterCalc.result;

  const filteredTanks = useMemo(() => {
    const q = tankQuery.trim().toLowerCase();
    if (q === "") return tanks.slice(0, 40);
    return tanks
      .filter((t) => {
        const hay =
          `${t.chart_number} ${t.manufacturer} ${t.capacity_liters}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 40);
  }, [tanks, tankQuery]);

  async function onSave() {
    setSaveError("");
    if (!selectedTank || !beforeResult || !afterResult) {
      setSaveError("Complete before and after dip calculations before saving.");
      return;
    }
    if (
      !Number.isFinite(planned) ||
      plannedDeliveryLiters.trim() === "" ||
      planned <= 0
    ) {
      setSaveError("Enter a planned delivery amount greater than zero.");
      return;
    }
    const sig = driverSignature.trim();
    if (sig === "") {
      setSaveError("Type your name as signature before saving.");
      return;
    }

    setSaving(true);
    const payload = toInsertPayload({
      companyId,
      driverId,
      tankTypeId: selectedTank.id,
      locationLabel: emptyToNull(locationLabel),
      safeFillPct,
      productGrade: emptyToNull(productGrade),
      compartmentNo: emptyToNull(compartmentNo),
      safeFillLiters: beforeResult.safeFillLiters,
      beforeDipCm: beforeDip,
      beforeVolumeLiters: beforeResult.beforeVolumeLiters,
      tankWillHoldLiters: beforeResult.tankWillHoldLiters,
      plannedDeliveryLiters: planned,
      afterDipCm: afterDip,
      afterVolumeLiters: afterResult.afterVolumeLiters,
      receiptVolumeLiters: afterResult.receiptVolumeLiters,
      volumeDifferenceLiters: afterResult.volumeDifferenceLiters,
      divertedTo: emptyToNull(divertedTo),
      newBolNo: emptyToNull(newBolNo),
      litersRetained:
        litersRetained.trim() === "" || !Number.isFinite(Number(litersRetained))
          ? null
          : Number(litersRetained),
      driverSignature: sig,
    });

    const { error } = await supabase.from("dip_calculations").insert(payload);
    setSaving(false);
    if (error) {
      setSaveError(error.message || "Save failed.");
      return;
    }
    resetSlot();
    setSavedFlash(true);
  }

  return (
    <div>
      {savedFlash && (
        <p
          className="mb-3 rounded-lg border border-[var(--success)] bg-[var(--card)] px-3 py-2 text-sm font-bold text-[var(--success)]"
          role="status"
        >
          Saved ✓
        </p>
      )}

      <section className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <label className="block">
          <span className="text-xs font-extrabold uppercase tracking-wide text-[var(--muted)]">
            Tank type
          </span>
          <input
            value={tankQuery}
            onChange={(e) => setTankQuery(e.target.value)}
            placeholder="Search chart #, manufacturer, capacity"
            className="mt-1.5 min-h-12 w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 text-[var(--text)] outline-none focus:border-[var(--accent)]"
          />
        </label>
        {selectedTank ? (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-[var(--input)] px-3 py-2">
            <p className="text-sm font-semibold text-[var(--text)]">
              #{selectedTank.chart_number} · {selectedTank.manufacturer} ·{" "}
              {Number(selectedTank.capacity_liters).toLocaleString("en-CA")} L
            </p>
            <button
              type="button"
              className="text-xs font-bold text-[var(--accent)]"
              onClick={clearSelectedTankOnly}
            >
              Change
            </button>
          </div>
        ) : (
          <ul className="max-h-48 overflow-y-auto rounded-lg border border-[var(--border)]">
            {filteredTanks.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => void selectTank(t)}
                  className="flex min-h-12 w-full flex-col items-start justify-center border-b border-[var(--border)] px-3 text-left last:border-b-0 hover:bg-[var(--input)]"
                >
                  <span className="text-sm font-bold text-[var(--text)]">
                    #{t.chart_number} · {t.manufacturer}
                  </span>
                  <span className="text-xs text-[var(--muted)]">
                    {Number(t.capacity_liters).toLocaleString("en-CA")} L
                  </span>
                </button>
              </li>
            ))}
            {filteredTanks.length === 0 && (
              <li className="px-3 py-4 text-sm text-[var(--muted)]">No tanks match.</li>
            )}
          </ul>
        )}
        {pointsLoading && (
          <p className="text-xs text-[var(--muted)]">Loading dip chart…</p>
        )}
        {pointsError !== "" && (
          <p className="text-xs font-semibold text-[var(--danger)]">{pointsError}</p>
        )}
      </section>

      <section className="mt-4 space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <p className="text-xs font-extrabold uppercase tracking-wide text-[var(--muted)]">
          Safe fill %
        </p>
        <div className="flex gap-2">
          {([0.9, 0.95] as const).map((pct) => (
            <button
              key={pct}
              type="button"
              onClick={() => setSafeFillPct(pct)}
              className={`min-h-11 flex-1 rounded-lg border px-3 text-sm font-bold ${
                safeFillPct === pct
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]"
                  : "border-[var(--border)] bg-[var(--input)] text-[var(--text)]"
              }`}
            >
              {pct === 0.9 ? "90%" : "95%"}
            </button>
          ))}
        </div>
        <Field
          label="Location label"
          value={locationLabel}
          onChange={setLocationLabel}
          optional
        />
        <Field
          label="Product grade"
          value={productGrade}
          onChange={setProductGrade}
          optional
        />
        <Field
          label="Compartment #"
          value={compartmentNo}
          onChange={setCompartmentNo}
          optional
        />
      </section>

      <section className="mt-4 space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <p className="text-xs font-extrabold uppercase tracking-wide text-[var(--muted)]">
          Before delivery
        </p>
        <Field
          label="#2 Before dip (cm)"
          value={beforeDipCm}
          onChange={setBeforeDipCm}
          inputMode="decimal"
        />
        <Field
          label="#4 Planned delivery (L)"
          value={plannedDeliveryLiters}
          onChange={setPlannedDeliveryLiters}
          inputMode="decimal"
        />
        <ResultRow label="#1 Safe fill" value={formatLiters(beforeResult?.safeFillLiters)} />
        <ResultRow
          label="#2 Before volume"
          value={formatLiters(beforeResult?.beforeVolumeLiters)}
        />
        <ResultRow
          label="#3 Tank will hold"
          value={formatLiters(beforeResult?.tankWillHoldLiters)}
        />
        {beforeResult?.overfillWarning && (
          <WarningBanner>
            DELIVER ONLY IF planned volume is less than tank will hold (#3). Planned
            delivery meets or exceeds remaining safe capacity.
          </WarningBanner>
        )}
      </section>

      <section className="mt-4 space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <p className="text-xs font-extrabold uppercase tracking-wide text-[var(--muted)]">
          After delivery
        </p>
        <Field
          label="#5 After dip (cm)"
          value={afterDipCm}
          onChange={setAfterDipCm}
          inputMode="decimal"
        />
        <ResultRow
          label="#5 After volume"
          value={formatLiters(afterResult?.afterVolumeLiters)}
        />
        <ResultRow
          label="#6 Receipt volume"
          value={formatLiters(afterResult?.receiptVolumeLiters)}
        />
        <ResultRow
          label="#7 Volume difference"
          value={formatLiters(afterResult?.volumeDifferenceLiters)}
        />
        {afterResult?.reversedDipWarning && (
          <WarningBanner>
            Closing dip is lower than opening dip — check for an entry error before
            saving.
          </WarningBanner>
        )}
        {afterResult?.overfillWarning && (
          <WarningBanner>
            After-delivery volume exceeds the safe-fill limit for this tank.
          </WarningBanner>
        )}
      </section>

      {dipError !== "" && (
        <p className="mt-4 rounded-lg border border-[var(--danger)] bg-[var(--danger-bg)] px-3 py-3 text-sm font-semibold text-[var(--danger)]">
          {dipError}
        </p>
      )}

      <section className="mt-4 space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <p className="text-xs font-extrabold uppercase tracking-wide text-[var(--muted)]">
          Retain / signature
        </p>
        <Field label="Diverted to" value={divertedTo} onChange={setDivertedTo} optional />
        <Field label="New BOL #" value={newBolNo} onChange={setNewBolNo} optional />
        <Field
          label="Liters retained"
          value={litersRetained}
          onChange={setLitersRetained}
          inputMode="decimal"
          optional
        />
        <Field
          label="Driver signature (typed name)"
          value={driverSignature}
          onChange={setDriverSignature}
        />
      </section>

      {saveError !== "" && (
        <p className="mt-4 text-sm font-semibold text-[var(--danger)]">{saveError}</p>
      )}

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void onSave()}
          className="min-h-12 flex-1 rounded-lg bg-[var(--accent)] text-base font-bold text-[var(--accent-fg)] disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save calculation"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={resetSlot}
          className="min-h-12 flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] text-base font-bold text-[var(--text)] disabled:opacity-60"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  inputMode,
  optional,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  inputMode?: "decimal" | "text";
  optional?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
        {label}
        {optional ? " (optional)" : ""}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode={inputMode}
        className="mt-1.5 min-h-12 w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 text-[var(--text)] outline-none focus:border-[var(--accent)]"
      />
    </label>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-[var(--border)] pt-2 first:border-t-0 first:pt-0">
      <span className="text-sm text-[var(--muted)]">{label}</span>
      <span className="font-mono text-lg font-bold tabular-nums text-[var(--text)]">
        {value}
      </span>
    </div>
  );
}

function WarningBanner({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-lg border-2 border-[var(--warn)] bg-[var(--warn-bg)] px-3 py-3 text-sm font-bold leading-snug text-[var(--warn-fg)]"
    >
      {children}
    </div>
  );
}
