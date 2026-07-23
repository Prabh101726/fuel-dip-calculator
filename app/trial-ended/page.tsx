"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function TrialEndedPage() {
  const router = useRouter();

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-12">
      <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">
        Fuel Dip Calculator
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--text)]">
        Your 14-day trial has ended
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
        Calculator and history are locked for this account. Contact us if you want
        to continue after the trial.
      </p>
      <button
        type="button"
        onClick={() => void logout()}
        className="mt-8 min-h-12 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 text-base font-bold text-[var(--text)]"
      >
        Log out
      </button>
    </main>
  );
}
