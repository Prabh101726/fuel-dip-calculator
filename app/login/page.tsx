"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setMessage("");

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message || "Could not send login link.");
      return;
    }

    setStatus("sent");
    setMessage("Check your email for the login link.");
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-12">
      <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">
        Fuel Dip Calculator
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--text)]">
        Sign in with email
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        We&apos;ll email you a magic link. First login starts a 14-day trial.
      </p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
            Email
          </span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-h-12 rounded-lg border border-[var(--border)] bg-[var(--input)] px-3.5 text-base text-[var(--text)] outline-none focus:border-[var(--accent)]"
            placeholder="you@company.com"
          />
        </label>

        <button
          type="submit"
          disabled={status === "sending"}
          className="min-h-12 rounded-lg bg-[var(--accent)] px-4 text-base font-bold text-[var(--accent-fg)] disabled:opacity-60"
        >
          {status === "sending" ? "Sending…" : "Email me a login link"}
        </button>
      </form>

      {message !== "" && (
        <p
          className={`mt-4 text-sm font-medium ${
            status === "error" ? "text-[var(--danger)]" : "text-[var(--success)]"
          }`}
          role="status"
        >
          {message}
        </p>
      )}
    </main>
  );
}
