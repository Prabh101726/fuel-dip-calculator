"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const urlError = useMemo(() => {
    const err = searchParams.get("error");
    const code = searchParams.get("error_code");
    if (code === "otp_expired" || err === "access_denied") {
      return "That email link expired. Sign in with your email and password instead.";
    }
    if (err === "auth") {
      return "Sign-in failed. Try again with email and password.";
    }
    return "";
  }, [searchParams]);

  async function afterAuth() {
    const supabase = createClient();
    await supabase.rpc("ensure_trial_driver");
    const { data: trialEndsAt } = await supabase.rpc("my_trial_ends_at");
    if (trialEndsAt && new Date(trialEndsAt as string).getTime() <= Date.now()) {
      router.replace("/trial-ended");
      router.refresh();
      return;
    }
    router.replace("/calculator");
    router.refresh();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setIsError(false);

    const supabase = createClient();
    const trimmed = email.trim();

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmed,
        password,
      });
      if (error) {
        setBusy(false);
        setIsError(true);
        setMessage(error.message || "Could not sign in.");
        return;
      }
      await afterAuth();
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: trimmed,
      password,
    });
    if (error) {
      setBusy(false);
      setIsError(true);
      setMessage(error.message || "Could not create account.");
      return;
    }

    if (!data.session) {
      setBusy(false);
      setIsError(false);
      setMessage(
        "Account created. If email confirmation is enabled, confirm your email, then sign in.",
      );
      setMode("signin");
      return;
    }

    await afterAuth();
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-12">
      <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">
        Fuel Dip Calculator
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--text)]">
        {mode === "signin" ? "Sign in" : "Start free trial"}
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Email and password. First sign-up starts a 14-day trial.
      </p>

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => {
            setMode("signin");
            setMessage("");
          }}
          className={`min-h-11 flex-1 rounded-lg border text-sm font-bold ${
            mode === "signin"
              ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]"
              : "border-[var(--border)] bg-[var(--card)] text-[var(--text)]"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("signup");
            setMessage("");
          }}
          className={`min-h-11 flex-1 rounded-lg border text-sm font-bold ${
            mode === "signup"
              ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]"
              : "border-[var(--border)] bg-[var(--card)] text-[var(--text)]"
          }`}
        >
          Create account
        </button>
      </div>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
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

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
            Password
          </span>
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-h-12 rounded-lg border border-[var(--border)] bg-[var(--input)] px-3.5 text-base text-[var(--text)] outline-none focus:border-[var(--accent)]"
            placeholder="At least 6 characters"
          />
        </label>

        <button
          type="submit"
          disabled={busy}
          className="min-h-12 rounded-lg bg-[var(--accent)] px-4 text-base font-bold text-[var(--accent-fg)] disabled:opacity-60"
        >
          {busy
            ? "Working…"
            : mode === "signin"
              ? "Sign in"
              : "Create account & start trial"}
        </button>
      </form>

      {(urlError !== "" || message !== "") && (
        <p
          className={`mt-4 text-sm font-medium ${
            isError || urlError !== "" ? "text-[var(--danger)]" : "text-[var(--success)]"
          }`}
          role="status"
        >
          {message || urlError}
        </p>
      )}
    </main>
  );
}
