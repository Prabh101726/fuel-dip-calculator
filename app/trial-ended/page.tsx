"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import SiteFooter from "@/app/components/SiteFooter";
import { CONTACT_EMAIL, MONTHLY_PRICE_LABEL, TRIAL_DAYS } from "@/lib/app-copy";
import { isActiveSubscriptionStatus } from "@/lib/billing/access";
import { startCheckout } from "@/lib/billing/startCheckout";
import { waitForActiveSubscriptionWithSync } from "@/lib/billing/waitForActiveSubscriptionWithSync";
import { createClient } from "@/lib/supabase/client";

export default function TrialEndedPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-12">
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        </main>
      }
    >
      <TrialEndedInner />
    </Suspense>
  );
}

function TrialEndedInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);
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
        setChecking(false);
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

      const awaitingCheckout = searchParams.get("checkout") === "success";
      if (awaitingCheckout) {
        setConfirmingPayment(true);
        setChecking(false);
        const ok = await waitForActiveSubscriptionWithSync(readStatus, {
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
      const url = await startCheckout({ cancelPath: "/trial-ended" });
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
        ) : (
          <p className="mt-3 text-sm text-[var(--muted)]">Loading…</p>
        )}
      </main>
    );
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

      {searchParams.get("checkout") === "success" ? (
        <p className="mt-4 text-sm font-semibold text-[var(--warn-fg)]">
          If you just paid, wait a moment and refresh before starting another
          checkout.
        </p>
      ) : null}

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
      <SiteFooter />
    </main>
  );
}
