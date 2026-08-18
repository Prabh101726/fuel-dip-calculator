"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import SiteFooter from "@/app/components/SiteFooter";
import { CONTACT_EMAIL } from "@/lib/app-copy";

export default function FeedbackPage() {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [online, setOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine,
  );

  useEffect(() => {
    function sync() {
      setOnline(navigator.onLine);
    }
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!online) return;
    setBusy(true);
    setError("");
    setDone(false);
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    setBusy(false);
    if (!res.ok) {
      let message = "Could not send feedback.";
      try {
        const data = (await res.json()) as { error?: string };
        if (data.error) message = data.error;
      } catch {
        /* keep default */
      }
      setError(message);
      return;
    }
    setBody("");
    setDone(true);
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col px-4 py-12">
      <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">
        Fuel Dip Calculator
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--text)]">
        Feedback
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Private message to Detours Fleet Operations. We get an email at{" "}
        {CONTACT_EMAIL} and keep a copy in the dashboard — not a public forum.
      </p>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
            Your message
          </span>
          <textarea
            required
            maxLength={2000}
            rows={8}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={!online || busy}
            className="min-h-32 rounded-lg border border-[var(--border)] bg-[var(--input)] px-3.5 py-3 text-base text-[var(--text)] outline-none focus:border-[var(--accent)] disabled:opacity-60"
          />
          <span className="text-xs text-[var(--muted)]">
            {body.length}/2000
          </span>
        </label>

        {!online && (
          <p className="text-sm font-medium text-[var(--warn-fg)]">
            Needs network.
          </p>
        )}
        {error && (
          <p className="text-sm font-medium text-[var(--danger)]">{error}</p>
        )}
        {done && (
          <p className="text-sm font-medium text-[var(--success)]">
            Thanks — we got it.
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !online}
          className="min-h-12 rounded-lg bg-[var(--accent)] px-4 text-base font-bold text-[var(--accent-fg)] disabled:opacity-60"
        >
          {busy ? "Sending…" : "Send"}
        </button>
      </form>

      <p className="mt-8">
        <Link href="/calculator" className="text-sm font-bold text-[var(--accent)]">
          Back to calculator
        </Link>
      </p>

      <SiteFooter />
    </main>
  );
}
