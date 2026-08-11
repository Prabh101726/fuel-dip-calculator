"use client";

import Link from "next/link";
import { CONTACT_EMAIL } from "@/lib/app-copy";

/**
 * Legacy password-reset landing. Auth is phone OTP only — old email reset
 * links should not mint a new password session path.
 */
export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-12">
      <h1 className="text-2xl font-bold text-[var(--text)]">
        Phone sign-in only
      </h1>
      <p className="mt-3 text-sm text-[var(--muted)]">
        Fuel Dip Calculator accounts use a Canada / US mobile number and a
        one-time text code. Email and password sign-in are no longer available.
      </p>
      <p className="mt-3 text-sm text-[var(--muted)]">
        If you previously used email, sign in with your phone number on the
        login page (first phone verify starts a new trial account). Need help?{" "}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="font-bold text-[var(--accent)]"
        >
          {CONTACT_EMAIL}
        </a>
        .
      </p>
      <Link
        href="/login"
        className="mt-8 inline-flex min-h-12 items-center justify-center rounded-lg bg-[var(--accent)] px-4 text-base font-bold text-[var(--accent-fg)]"
      >
        Go to phone sign in
      </Link>
    </main>
  );
}
