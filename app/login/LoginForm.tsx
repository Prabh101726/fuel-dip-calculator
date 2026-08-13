"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import SiteFooter from "@/app/components/SiteFooter";
import { SAFETY_REMINDER, TRIAL_DAYS } from "@/lib/app-copy";
import { mapOtpThrottleError } from "@/lib/auth/otpThrottle";
import { safePostAuthNext } from "@/lib/auth/safeNextPath";
import { formatNanpDisplay, toNanpE164 } from "@/lib/phone";
import {
  clearStoredReferralCode,
  readStoredReferralCode,
  rememberReferralCodeFromUrl,
} from "@/lib/referral/storage";
import { createClient } from "@/lib/supabase/client";

type Path = "phone" | "verify";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [path, setPath] = useState<Path>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const urlError = useMemo(() => {
    const err = searchParams.get("error");
    const code = searchParams.get("error_code");
    if (code === "otp_expired" || err === "access_denied") {
      return "That link expired. Sign in with your mobile number.";
    }
    if (err === "auth") {
      return "Sign-in failed. Try again.";
    }
    return "";
  }, [searchParams]);

  useEffect(() => {
    rememberReferralCodeFromUrl(searchParams.get("ref"));
  }, [searchParams]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  async function afterAuth() {
    const supabase = createClient();
    await supabase.rpc("ensure_trial_driver");
    const ref = readStoredReferralCode();
    if (ref) {
      await supabase.rpc("claim_referral", { p_code: ref });
      clearStoredReferralCode();
    }
    const { data: accessActive, error } = await supabase.rpc("my_access_active");
    const next = safePostAuthNext(searchParams.get("next"));
    if (error || accessActive !== true) {
      router.replace(
        next === "/subscribe" || next === "/feedback" || next === "/refer"
          ? next
          : "/trial-ended",
      );
      router.refresh();
      return;
    }
    router.replace(next);
    router.refresh();
  }

  async function requestThrottle(e164: string): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase.rpc("request_otp_throttle", {
      p_phone: e164,
    });
    const mapped = mapOtpThrottleError(
      error
        ? {
            code: error.code,
            message: error.message,
            hint: error.hint,
          }
        : null,
    );
    if (!mapped.ok) {
      setIsError(true);
      setMessage(mapped.message);
      return false;
    }
    return true;
  }

  async function sendOtp(e164: string) {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      phone: e164,
      options: { shouldCreateUser: true },
    });
    if (error) {
      setIsError(true);
      setMessage(error.message || "Could not send verification code.");
      return false;
    }
    return true;
  }

  async function onSendCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setIsError(false);

    const e164 = toNanpE164(phone);
    if (!e164) {
      setBusy(false);
      setIsError(true);
      setMessage("Enter a valid Canada / US mobile number.");
      return;
    }
    if (!acceptedLegal) {
      setBusy(false);
      setIsError(true);
      setMessage("Please agree to the Terms of Use and Privacy Policy.");
      return;
    }

    const allowed = await requestThrottle(e164);
    if (!allowed) {
      setBusy(false);
      return;
    }

    const ok = await sendOtp(e164);
    setBusy(false);
    if (!ok) return;

    setPhone(e164);
    setOtp("");
    setResendCooldown(60);
    setPath("verify");
    setIsError(false);
    setMessage(`Code sent to ${formatNanpDisplay(e164)}.`);
  }

  async function onVerify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setIsError(false);

    const e164 = toNanpE164(phone);
    const token = otp.replace(/\D/g, "").slice(0, 6);
    if (!e164 || token.length < 6) {
      setBusy(false);
      setIsError(true);
      setMessage("Enter the 6-digit code from your text message.");
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      phone: e164,
      token,
      type: "sms",
    });
    if (error) {
      setBusy(false);
      setIsError(true);
      setMessage(error.message || "Invalid or expired code.");
      return;
    }
    await afterAuth();
  }

  async function onResend() {
    if (resendCooldown > 0 || busy) return;
    setBusy(true);
    setMessage("");
    setIsError(false);
    const e164 = toNanpE164(phone);
    if (!e164) {
      setBusy(false);
      setIsError(true);
      setMessage("Enter a valid Canada / US mobile number.");
      return;
    }
    const allowed = await requestThrottle(e164);
    if (!allowed) {
      setBusy(false);
      return;
    }
    const ok = await sendOtp(e164);
    setBusy(false);
    if (!ok) return;
    setResendCooldown(60);
    setOtp("");
    setIsError(false);
    setMessage("New code sent.");
  }

  const title = path === "verify" ? "Enter code" : "Sign in";
  const subtitle =
    path === "verify"
      ? `We texted a 6-digit code to ${formatNanpDisplay(phone)}.`
      : `Canada / US mobile. First sign-in starts a ${TRIAL_DAYS}-day trial.`;

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-12">
      <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">
        Fuel Dip Calculator
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--text)]">
        {title}
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">{subtitle}</p>
      <p className="mt-4 rounded-lg border border-[var(--warn)] bg-[var(--warn-bg)] px-3 py-2.5 text-sm font-medium text-[var(--warn-fg)]">
        {SAFETY_REMINDER}
      </p>

      {path === "phone" ? (
        <form onSubmit={onSendCode} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
              Mobile number
            </span>
            <input
              type="tel"
              required
              autoComplete="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="min-h-12 rounded-lg border border-[var(--border)] bg-[var(--input)] px-3.5 text-base text-[var(--text)] outline-none focus:border-[var(--accent)]"
              placeholder="(416) 555-0100"
            />
            <span className="text-xs text-[var(--muted)]">
              Canada / US (+1). We’ll text a one-time code.
            </span>
          </label>

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
              <Link
                href="/privacy"
                className="font-bold text-[var(--accent)]"
              >
                Privacy Policy
              </Link>
              .
            </span>
          </label>

          <button
            type="submit"
            disabled={busy}
            className="min-h-12 rounded-lg bg-[var(--accent)] px-4 text-base font-bold text-[var(--accent-fg)] disabled:opacity-60"
          >
            {busy ? "Sending…" : "Send verification code"}
          </button>
        </form>
      ) : (
        <form onSubmit={onVerify} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
              Verification code
            </span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              value={otp}
              onChange={(e) =>
                setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className="min-h-12 rounded-lg border border-[var(--border)] bg-[var(--input)] px-3.5 text-center text-2xl tracking-[0.35em] text-[var(--text)] outline-none focus:border-[var(--accent)]"
              placeholder="••••••"
            />
          </label>

          <button
            type="submit"
            disabled={busy || otp.length < 6}
            className="min-h-12 rounded-lg bg-[var(--accent)] px-4 text-base font-bold text-[var(--accent-fg)] disabled:opacity-60"
          >
            {busy ? "Checking…" : "Verify & continue"}
          </button>

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <button
              type="button"
              onClick={() => {
                setPath("phone");
                setOtp("");
                setMessage("");
                setIsError(false);
              }}
              className="font-bold text-[var(--accent)]"
            >
              Change number
            </button>
            <button
              type="button"
              disabled={busy || resendCooldown > 0}
              onClick={() => void onResend()}
              className="font-bold text-[var(--accent)] disabled:opacity-50"
            >
              {resendCooldown > 0
                ? `Resend in ${resendCooldown}s`
                : "Resend code"}
            </button>
          </div>
        </form>
      )}

      {(urlError !== "" || message !== "") && (
        <p
          className={`mt-4 text-sm font-medium ${
            isError || urlError !== ""
              ? "text-[var(--danger)]"
              : "text-[var(--success)]"
          }`}
          role="status"
        >
          {message || urlError}
        </p>
      )}

      <SiteFooter
        className="mt-8 flex flex-col items-center gap-3"
        linksClassName="flex flex-wrap justify-center gap-4 text-sm text-[var(--muted)]"
        linkClassName="font-bold text-[var(--accent)]"
        versionClassName="text-xs font-medium text-[var(--muted)]"
      />
    </main>
  );
}
