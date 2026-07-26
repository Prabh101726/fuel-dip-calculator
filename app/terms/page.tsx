import Link from "next/link";
import { CONTACT_EMAIL, TRIAL_DAYS } from "@/lib/app-copy";

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-lg px-4 py-10">
      <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">
        Fuel Dip Calculator
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--text)]">
        Terms of Use
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Operated by SRV Freight Inc. Last updated: July 26, 2026.
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-[var(--text)]">
        <section className="space-y-2">
          <h2 className="text-base font-bold">The service</h2>
          <p className="text-[var(--muted)]">
            Fuel Dip Calculator helps fuel delivery drivers convert tank dip
            readings to volumes and estimate safe discharge headroom using
            published dip charts. It is a web tool for signed-in users.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">Safety and your responsibility</h2>
          <p className="text-[var(--muted)]">
            Always verify that the physical tank tag matches the chart number
            selected in the app before delivery. This tool assists with
            calculations; it does not replace site procedures, the Safe
            Discharge Sheet process, or your professional judgment. You are
            responsible for safe discharge decisions in the field.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">Trial and paid plans</h2>
          <p className="text-[var(--muted)]">
            New accounts receive a {TRIAL_DAYS}-day trial. We plan to offer paid
            access at $4.99 per month per account. Payment processing is not
            live yet; after the trial, calculator and history access may be
            locked until a paid plan is available or access is arranged.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">Acceptable use</h2>
          <p className="text-[var(--muted)]">
            Use the service only for lawful fuel-delivery operations. Do not
            attempt to disrupt the service, access other companies&apos; data,
            or misuse trial access.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">Limitation of liability</h2>
          <p className="text-[var(--muted)]">
            The service is provided as-is for operational assistance. To the
            fullest extent permitted by law, SRV Freight Inc is not liable for
            spills, overfills, delivery errors, or other damages arising from
            reliance on the calculator. Use verified tank tags and site
            procedures.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">Governing law</h2>
          <p className="text-[var(--muted)]">
            These terms are governed by the laws of the Province of Ontario and
            the applicable laws of Canada.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">Contact</h2>
          <p className="text-[var(--muted)]">
            Questions:{" "}
            <a
              className="font-bold text-[var(--accent)]"
              href={`mailto:${CONTACT_EMAIL}`}
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </section>
      </div>

      <p className="mt-10">
        <Link href="/login" className="text-sm font-bold text-[var(--accent)]">
          Back to sign in
        </Link>
      </p>
    </main>
  );
}
