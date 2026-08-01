"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MONTHLY_PRICE_LABEL } from "@/lib/app-copy";
import { isActiveSubscriptionStatus } from "@/lib/billing/access";
import { startCheckout } from "@/lib/billing/startCheckout";
import { createClient } from "@/lib/supabase/client";

export default function SubscribePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: driver } = await supabase
        .from("drivers")
        .select("subscription_status")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;
      if (isActiveSubscriptionStatus(driver?.subscription_status)) {
        router.replace("/calculator");
        return;
      }
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function onSubscribe() {
    setError("");
    setLoading(true);
    try {
      const url = await startCheckout({ cancelPath: "/subscribe" });
      window.location.href = url;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not start checkout. Check your connection.",
      );
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-12">
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-12">
      <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">
        Fuel Dip Calculator
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--text)]">
        Subscribe
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
        Your trial is still active. You can subscribe now for{" "}
        {MONTHLY_PRICE_LABEL}; access continues after the trial ends.
      </p>

      <button
        type="button"
        disabled={loading}
        onClick={() => void onSubscribe()}
        className="mt-8 min-h-12 rounded-lg bg-[var(--accent)] px-4 text-base font-bold text-[var(--accent-fg)] disabled:opacity-60"
      >
        {loading ? "Redirecting…" : `Subscribe — ${MONTHLY_PRICE_LABEL}`}
      </button>

      {error !== "" && (
        <p className="mt-3 text-sm font-semibold text-[var(--danger)]" role="status">
          {error}
        </p>
      )}

      <Link
        href="/calculator"
        className="mt-6 min-h-12 content-center text-center text-base font-bold text-[var(--accent)]"
      >
        Back to calculator
      </Link>
    </main>
  );
}
