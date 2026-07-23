"use client";

import dynamic from "next/dynamic";

const CalculatorClient = dynamic(() => import("./CalculatorClient"), {
  ssr: false,
  loading: () => (
    <main className="mx-auto max-w-lg px-4 py-10 text-sm text-[var(--muted)]">
      Loading calculator…
    </main>
  ),
});

export default function CalculatorPage() {
  return <CalculatorClient />;
}
