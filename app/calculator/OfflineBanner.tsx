"use client";

type Props = {
  online: boolean;
  pendingCount: number;
  failedCount: number;
};

export default function OfflineBanner({
  online,
  pendingCount,
  failedCount,
}: Props) {
  const pendingLabel =
    pendingCount > 0
      ? ` · ${pendingCount} pending sync`
      : "";
  const failedLabel =
    failedCount > 0 ? ` · ${failedCount} failed (will not retry)` : "";

  return (
    <p
      className={`mb-4 rounded-lg border px-3 py-2 text-sm font-semibold ${
        online
          ? "border-[var(--border)] bg-[var(--card)] text-[var(--muted)]"
          : "border-[var(--warn)] bg-[var(--warn-bg)] text-[var(--warn-fg)]"
      }`}
      role="status"
    >
      {online ? "Online" : "Offline"}
      {pendingLabel}
      {failedLabel}
    </p>
  );
}
