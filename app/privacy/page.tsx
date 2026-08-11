import Link from "next/link";
import { CONTACT_EMAIL, OPERATOR_NAME } from "@/lib/app-copy";

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-lg px-4 py-10">
      <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">
        Fuel Dip Calculator
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--text)]">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Operated by {OPERATOR_NAME}. Last updated: August 11, 2026.
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-[var(--text)]">
        <section className="space-y-2">
          <h2 className="text-base font-bold">What we collect</h2>
          <p className="text-[var(--muted)]">
            When you create an account we store your phone number (for SMS
            one-time codes) and authentication identifiers from Supabase Auth.
            SMS delivery is handled by our SMS provider. Older accounts may
            still have an email address on file. When you use the calculator we
            store company and trial metadata, and any dip calculations you save
            (tank chart selection, dips, volumes, location label, typed
            signature name, and related discharge fields).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">Shared reference data</h2>
          <p className="text-[var(--muted)]">
            Dip chart catalog data (tank types and dip/volume points) is shared
            reference information used by the app. It is not personal data and
            is not owned by an individual driver account.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">How we use data</h2>
          <p className="text-[var(--muted)]">
            We use this information to provide the calculator, keep your history,
            enforce trial access, and operate and secure the service. We do not
            sell your personal data.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">Retention</h2>
          <p className="text-[var(--muted)]">
            We keep account and calculation data while your account is active and
            as needed to operate the service, meet legal obligations, or resolve
            disputes.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">Contact</h2>
          <p className="text-[var(--muted)]">
            Privacy questions:{" "}
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
