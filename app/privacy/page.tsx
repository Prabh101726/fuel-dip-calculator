import Link from "next/link";
import SiteFooter from "@/app/components/SiteFooter";
import { CONTACT_EMAIL, OPERATOR_NAME } from "@/lib/app-copy";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata(
  "Privacy policy",
  "What Fuel Dip Calculator collects, stores, and never stores.",
);

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
        Operated by {OPERATOR_NAME}. Last updated: August 18, 2026.
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-[var(--text)]">
        <section className="space-y-2">
          <h2 className="text-base font-bold">What we collect</h2>
          <p className="text-[var(--muted)]">
            Sign-in is by Canada / US mobile number. We store your phone number
            and authentication identifiers so we can text a one-time code and
            keep you signed in. SMS is sent by our messaging provider. Some
            older accounts may still have an email address on file; we do not
            ask new drivers for an email to create an account. When you use the
            calculator we store company and trial metadata, and any dip
            calculations you save (tank chart selection, dips, volumes, location
            label, typed signature name, and related discharge fields). If you
            send in-app feedback, we store that message with your driver account
            (and may email it to our operations inbox).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">Payments (Stripe)</h2>
          <p className="text-[var(--muted)]">
            Paid subscriptions are billed by Stripe, not by us. When you start
            Checkout we create a Stripe Customer and send Stripe the phone
            number on your account (and an email if one already exists). On
            Stripe&apos;s Checkout page you enter payment card details and the
            billing contact Stripe needs to charge you and send receipts —
            typically an email address, and any phone Stripe shows on that form.
            That billing email/phone may be what you type at Checkout or what
            is already attached to the card / Stripe customer. We store Stripe
            customer and subscription identifiers and status so we can unlock
            the app and open the billing portal. We do not store full card
            numbers, CVC, or expiry on our servers. Stripe processes that
            payment data under{" "}
            <a
              className="font-bold text-[var(--accent)]"
              href="https://stripe.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Stripe&apos;s Privacy Policy
            </a>
            .
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
            We use this information to sign you in, provide the calculator, keep
            your history, run trial and paid access, send operational messages
            (SMS codes, feedback to our inbox), and operate and secure the
            service. We do not sell your personal data.
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

      <SiteFooter />
    </main>
  );
}
