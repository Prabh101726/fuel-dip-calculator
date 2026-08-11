"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return true;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function wasDismissed(): boolean {
  try {
    return localStorage.getItem("fuel-dip-install-hint-dismissed") === "1";
  } catch {
    return false;
  }
}

/**
 * Add-to-home-screen / install control.
 * - Chromium: uses beforeinstallprompt when the browser offers it.
 * - iOS Safari: Apple blocks programmatic install — show Share steps.
 */
export default function InstallHint() {
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (isStandalone() || wasDismissed()) return;

    setIos(isIos());
    setVisible(true);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  if (!visible) return null;

  function dismiss() {
    try {
      localStorage.setItem("fuel-dip-install-hint-dismissed", "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  async function onInstall() {
    if (!deferred || installing) return;
    setInstalling(true);
    try {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
      setVisible(false);
    } catch {
      /* user closed sheet or browser blocked */
    } finally {
      setInstalling(false);
    }
  }

  return (
    <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-[var(--muted)]">
      <p className="font-medium leading-snug text-[var(--text)]">
        {ios
          ? "Add to Home Screen for offline use: tap Share, then Add to Home Screen."
          : deferred
            ? "Install Fuel Dip on this device for offline use."
            : "Install for offline use: open the browser menu → Install app (or Add to Home screen)."}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {!ios && deferred && (
          <button
            type="button"
            onClick={() => void onInstall()}
            disabled={installing}
            className="min-h-11 rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-[var(--accent-fg)] disabled:opacity-60"
          >
            {installing ? "Opening…" : "Add to Home Screen"}
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          className="min-h-11 text-xs font-bold text-[var(--accent)]"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
