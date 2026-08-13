import Link from "next/link";
import SiteFooter from "@/app/components/SiteFooter";
import { MONTHLY_PRICE_LABEL, TRIAL_DAYS } from "@/lib/app-copy";
import ReferShare from "./ReferShare";

export default function ReferPage() {
  return (
    <main className="mx-auto w-full max-w-lg px-4 py-10">
      <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">
        Fuel Dip Calculator
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--text)]">
        Refer a driver
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Share your personal signup link. You earn extra days when they
        subscribe — they keep the normal trial.
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-[var(--text)]">
        <section className="space-y-2">
          <h2 className="text-base font-bold">How it works</h2>
          <ol className="list-decimal space-y-2 pl-5 text-[var(--muted)]">
            <li>
              Share your link (button below, or Share on the calculator).
            </li>
            <li>
              Your friend signs in with their Canada / US mobile number. They
              get the normal {TRIAL_DAYS}-day trial. Nothing extra is added to
              their trial.
            </li>
            <li>
              When they subscribe ({MONTHLY_PRICE_LABEL}), you get{" "}
              <span className="font-bold text-[var(--text)]">14 extra days</span>
              . If you are still on trial, those days add to your trial clock.
              If you already pay, they push your next Stripe renewal out by 14
              days.
            </li>
          </ol>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">Rules</h2>
          <p className="text-[var(--muted)]">
            You cannot refer yourself. Each friend only counts once, and only
            after they actually pay. Credit is 14 days for you, at operator
            discretion if we see abuse.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold">Your link</h2>
          <ReferShare />
        </section>
      </div>

      <p className="mt-10 flex flex-wrap gap-4">
        <Link href="/calculator" className="text-sm font-bold text-[var(--accent)]">
          Calculator
        </Link>
        <Link href="/login" className="text-sm font-bold text-[var(--accent)]">
          Sign in
        </Link>
      </p>

      <SiteFooter />
    </main>
  );
}
