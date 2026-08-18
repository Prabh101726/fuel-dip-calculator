import Link from "next/link";
import SiteFooter from "@/app/components/SiteFooter";
import {
  CONTACT_EMAIL,
  MONTHLY_PRICE_LABEL,
  OPERATOR_NAME,
  SAFETY_REMINDER,
  TRIAL_DAYS,
} from "@/lib/app-copy";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata(
  "About",
  "What Fuel Dip Calculator is, who operates it, and what it costs.",
);

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-lg px-4 py-10">
      <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">
        Fuel Dip Calculator
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--text)]">
        About
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Operated by {OPERATOR_NAME}.
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-[var(--text)]">
        <section className="space-y-2">
          <h2 className="text-base font-bold">What this is</h2>
          <p className="text-[var(--muted)]">
            Fuel Dip Calculator replaces the paper Safe Discharge Sheet and a
            large dip-chart PDF. Drivers pick a tank chart and safe-fill %,
            enter a dip reading, and get volume and safe headroom instantly.
            After delivery, enter the closing dip for delivered volume and
            reconciliation.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">Who operates it</h2>
          <p className="text-[var(--muted)]">
            {OPERATOR_NAME}. Contact:{" "}
            <a
              className="font-bold text-[var(--accent)]"
              href={`mailto:${CONTACT_EMAIL}`}
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">Trial and pricing</h2>
          <p className="text-[var(--muted)]">
            New drivers get a {TRIAL_DAYS}-day trial. After that, access is{" "}
            {MONTHLY_PRICE_LABEL}, billed through Stripe. You can subscribe
            during the trial from the calculator.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">Safety</h2>
          <p className="text-[var(--muted)]">{SAFETY_REMINDER}</p>
        </section>
      </div>

      <p className="mt-10">
        <Link href="/login" className="text-sm font-bold text-[var(--accent)]">
          Back to sign in
        </Link>
      </p>

      <SiteFooter />
    </main>
  );
}
