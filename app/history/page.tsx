import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type TankEmbed = { chart_number: string; manufacturer: string };

type HistoryRow = {
  id: string;
  created_at: string;
  location_label: string | null;
  receipt_volume_liters: number | null;
  volume_difference_liters: number | null;
  tank_types: TankEmbed | TankEmbed[] | null;
};

function tankLabelFromEmbed(embed: HistoryRow["tank_types"]): string {
  const tank = Array.isArray(embed) ? embed[0] : embed;
  if (!tank) return "Tank";
  return `#${tank.chart_number} · ${tank.manufacturer}`;
}

function formatLiters(n: number | null): string {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `${Math.round(Number(n)).toLocaleString("en-CA")} L`;
}

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("dip_calculations")
    .select(
      "id, created_at, location_label, receipt_volume_liters, volume_difference_liters, tank_types(chart_number, manufacturer)",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (data ?? []) as unknown as HistoryRow[];

  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-24 pt-6">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">
            Safe discharge
          </p>
          <h1 className="text-2xl font-bold text-[var(--text)]">History</h1>
        </div>
        <Link
          href="/calculator"
          className="min-h-11 content-center text-sm font-bold text-[var(--accent)]"
        >
          Calculator
        </Link>
      </header>

      {error && (
        <p className="mb-4 text-sm font-semibold text-[var(--danger)]">
          Could not load history. Retry by refreshing.
        </p>
      )}

      {!error && rows.length === 0 && (
        <p className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-8 text-center text-sm text-[var(--muted)]">
          No calculations saved yet.
        </p>
      )}

      <ul className="space-y-3">
        {rows.map((row) => {
          const when = new Date(row.created_at);
          const dateLabel = Number.isNaN(when.getTime())
            ? row.created_at
            : when.toLocaleString("en-CA", {
                dateStyle: "medium",
                timeStyle: "short",
              });
          const tankLabel = tankLabelFromEmbed(row.tank_types);
          return (
            <li
              key={row.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3"
            >
              <p className="text-xs font-medium text-[var(--muted)]">{dateLabel}</p>
              <p className="mt-1 text-base font-bold text-[var(--text)]">{tankLabel}</p>
              <p className="mt-0.5 text-sm text-[var(--muted)]">
                {row.location_label?.trim() || "No location"}
              </p>
              <div className="mt-3 flex justify-between gap-3 text-sm">
                <span className="text-[var(--muted)]">Receipt</span>
                <span className="font-mono font-bold tabular-nums text-[var(--text)]">
                  {formatLiters(row.receipt_volume_liters)}
                </span>
              </div>
              <div className="mt-1 flex justify-between gap-3 text-sm">
                <span className="text-[var(--muted)]">Difference</span>
                <span className="font-mono font-bold tabular-nums text-[var(--text)]">
                  {formatLiters(row.volume_difference_liters)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
