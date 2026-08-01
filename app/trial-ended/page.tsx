"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CONTACT_EMAIL, MONTHLY_PRICE_LABEL, TRIAL_DAYS } from "@/lib/app-copy";
import { startCheckout } from "@/lib/billing/startCheckout";
import { createClient } from "@/lib/supabase/client";

export default function TrialEndedPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  async function subscribe() {
    setBusy(true);
    setError("");
    try {
      const url = await startCheckout();
      window.location.href = url;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not start checkout. Check your connection.",
      );
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-12">
      <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">
        Fuel Dip Calculator
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--text)]">
        Your {TRIAL_DAYS}-day trial has ended
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
        Calculator and history are locked for this driver. Subscribe for{" "}
        {MONTHLY_PRICE_LABEL} to keep calculating dips and saving deliveries.
      </p>

      <button
        type="button"
        disabled={busy}
        onClick={() => void subscribe()}
        className="mt-8 min-h-12 rounded-lg bg-[var(--accent)] px-4 text-base font-bold text-[var(--accent-fg)] disabled:opacity-60"
      >
        {busy ? "Redirecting…" : `Subscribe — ${MONTHLY_PRICE_LABEL}`}
      </button>

      {error !== "" && (
        <p className="mt-3 text-sm font-semibold text-[var(--danger)]" role="status">
          {error}
        </p>
      )}

      <p className="mt-4 text-sm text-[var(--muted)]">
        Questions?{" "}
        <a
          className="font-bold text-[var(--accent)]"
          href={`mailto:${CONTACT_EMAIL}`}
        >
          {CONTACT_EMAIL}
        </a>
      </p>

      <button
        type="button"
        onClick={() => void logout()}
        className="mt-6 min-h-12 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 text-base font-bold text-[var(--text)]"
      >
        Log out
      </button>
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
