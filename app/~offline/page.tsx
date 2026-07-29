import Link from "next/link";

export default function OfflineFallbackPage() {
  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-2xl font-bold text-[var(--text)]">You&apos;re offline</h1>
      <p className="mt-3 text-sm text-[var(--muted)]">
        This page isn&apos;t available offline. Open the calculator — used tanks
        and drafts still work without a network.
      </p>
      <Link
        href="/calculator"
        className="mt-8 inline-flex min-h-12 items-center rounded-lg bg-[var(--accent)] px-4 font-bold text-[var(--accent-fg)]"
      >
        Open calculator
      </Link>
    </main>
  );
}
