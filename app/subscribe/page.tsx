"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { MONTHLY_PRICE_LABEL } from "@/lib/app-copy";
import { isActiveSubscriptionStatus } from "@/lib/billing/access";
import { startCheckout } from "@/lib/billing/startCheckout";
import { waitForActiveSubscription } from "@/lib/billing/waitForActiveSubscription";
import { createClient } from "@/lib/supabase/client";

export default function SubscribePage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-12">
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        </main>
      }
    >
      <SubscribeInner />
    </Suspense>
  );
}

function SubscribeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const [confirmingPayment, setConfirmingPayment] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();

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

      async function readStatus(): Promise<string | null> {
        const { data: driver } = await supabase
          .from("drivers")
          .select("subscription_status")
          .eq("id", user!.id)
          .maybeSingle();
        return typeof driver?.subscription_status === "string"
          ? driver.subscription_status
          : null;
      }

      const initial = await readStatus();
      if (cancelled) return;
      if (isActiveSubscriptionStatus(initial)) {
        router.replace("/calculator");
        return;
      }

      if (searchParams.get("checkout") === "success") {
        setConfirmingPayment(true);
        setChecking(false);
        const ok = await waitForActiveSubscription(readStatus, {
          timeoutMs: 10_000,
          intervalMs: 800,
          signal: ac.signal,
        });
        if (cancelled) return;
        if (ok) {
          router.replace("/calculator");
          return;
        }
        setConfirmingPayment(false);
      }

      setChecking(false);
    })();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [router, searchParams]);

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

  if (checking || confirmingPayment) {
    return (
      <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-12">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">
          {confirmingPayment ? "Confirming payment…" : "Loading…"}
        </h1>
        {confirmingPayment ? (
          <p className="mt-3 text-sm text-[var(--muted)]">
            Your payment was received. Unlocking access — do not start another
            checkout.
          </p>
        ) : null}
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

      {searchParams.get("checkout") === "success" ? (
        <p className="mt-4 text-sm font-semibold text-[var(--warn-fg)]">
          If you just paid, wait a moment and refresh before starting another
          checkout.
        </p>
      ) : null}

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
