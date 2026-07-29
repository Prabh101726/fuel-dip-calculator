"use client";

import { useState } from "react";

function shouldShowInstallHint(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (localStorage.getItem("fuel-dip-install-hint-dismissed") === "1") {
      return false;
    }
  } catch {
    /* ignore */
  }
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true);
  return !standalone;
}

/**
 * Short install hint for first-run. Dismissable; stored in localStorage.
 */
export default function InstallHint() {
  const [show, setShow] = useState(shouldShowInstallHint);

  if (!show) return null;

  function dismiss() {
    try {
      localStorage.setItem("fuel-dip-install-hint-dismissed", "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  return (
    <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-[var(--muted)]">
      <p className="font-medium leading-snug text-[var(--text)]">
        Install for offline use: on iPhone use Share → Add to Home Screen; on
        Android use the browser menu → Install app.
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="mt-2 min-h-11 text-xs font-bold text-[var(--accent)]"
      >
        Dismiss
      </button>
    </div>
  );
}
