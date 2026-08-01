"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import SiteFooter from "@/app/components/SiteFooter";
import {
  SAFETY_REMINDER,
  TRIAL_DAYS,
  authCallbackUrl,
  resetPasswordUrl,
} from "@/lib/app-copy";
import { safePostAuthNext } from "@/lib/auth/safeNextPath";
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
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);

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
    const { data: accessActive, error } = await supabase.rpc("my_access_active");
    const next = safePostAuthNext(searchParams.get("next"));
    if (error || accessActive !== true) {
      // Expired trial: allow /subscribe so they can pay; otherwise lock screen.
      router.replace(next === "/subscribe" ? "/subscribe" : "/trial-ended");
      router.refresh();
      return;
    }
    router.replace(next);
    router.refresh();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setIsError(false);

    const supabase = createClient();
    const trimmed = email.trim();

    if (forgotMode) {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: resetPasswordUrl(window.location.origin),
      });
      setBusy(false);
      if (error) {
        setIsError(true);
        setMessage(error.message || "Could not send reset email.");
        return;
      }
      setIsError(false);
      setMessage("Check your email for a password reset link.");
      return;
    }

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

    if (!acceptedLegal) {
      setBusy(false);
      setIsError(true);
      setMessage("Please agree to the Terms of Use and Privacy Policy.");
      return;
    }

    const origin = window.location.origin;
    const { data, error } = await supabase.auth.signUp({
      email: trimmed,
      password,
      options: {
        emailRedirectTo: authCallbackUrl(origin),
      },
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
      setMessage("Account created. Check your email to confirm, then sign in.");
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
        {forgotMode
          ? "Reset password"
          : mode === "signin"
            ? "Sign in"
            : "Start free trial"}
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Email and password. First sign-up starts a {TRIAL_DAYS}-day trial.
      </p>
      <p className="mt-4 rounded-lg border border-[var(--warn)] bg-[var(--warn-bg)] px-3 py-2.5 text-sm font-medium text-[var(--warn-fg)]">
        {SAFETY_REMINDER}
      </p>

      {!forgotMode && <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => {
            setMode("signin");
            setForgotMode(false);
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
            setForgotMode(false);
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
      </div>}

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

        {!forgotMode && (
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
        )}

        {mode === "signup" && !forgotMode && (
          <label className="flex items-start gap-3 text-sm text-[var(--muted)]">
            <input
              type="checkbox"
              checked={acceptedLegal}
              onChange={(e) => setAcceptedLegal(e.target.checked)}
              className="mt-1"
              required
            />
            <span>
              I agree to the{" "}
              <Link href="/terms" className="font-bold text-[var(--accent)]">
                Terms of Use
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="font-bold text-[var(--accent)]">
                Privacy Policy
              </Link>
              .
            </span>
          </label>
        )}

        <button
          type="submit"
          disabled={busy}
          className="min-h-12 rounded-lg bg-[var(--accent)] px-4 text-base font-bold text-[var(--accent-fg)] disabled:opacity-60"
        >
          {busy
            ? "Working…"
            : forgotMode
              ? "Send reset link"
              : mode === "signin"
              ? "Sign in"
              : "Create account & start trial"}
        </button>
      </form>

      {mode === "signin" && (
        <button
          type="button"
          onClick={() => {
            setForgotMode(!forgotMode);
            setMessage("");
            setIsError(false);
          }}
          className="mt-4 text-sm font-bold text-[var(--accent)]"
        >
          {forgotMode ? "Back to sign in" : "Forgot password?"}
        </button>
      )}

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

      <SiteFooter
        className="mt-8 flex flex-wrap justify-center gap-4 text-sm text-[var(--muted)]"
        linkClassName="font-bold text-[var(--accent)]"
      />
    </main>
  );
}
