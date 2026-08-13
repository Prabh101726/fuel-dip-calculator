import Link from "next/link";
import { MONTHLY_PRICE_LABEL, SAFETY_REMINDER } from "@/lib/app-copy";

export default function GuidePage() {
  return (
    <main className="mx-auto w-full max-w-lg px-4 py-10">
      <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">
        Fuel Dip Calculator
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--text)]">
        User guide
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Quick steps for a safe discharge calculation.
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-[var(--text)]">
        <section className="space-y-2">
          <h2 className="text-base font-bold">1. Sign in</h2>
          <p className="text-[var(--muted)]">
            Sign in with your Canada / US mobile number — we text a one-time
            code. First sign-in starts your trial. New accounts use phone only.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">2. Pick a tank tab</h2>
          <p className="text-[var(--muted)]">
            Use tabs 1–4 for up to four tanks at a site. Labels show the slot
            number plus product grade or chart (for example{" "}
            <span className="font-bold text-[var(--text)]">1. E15 Reg</span>).
            Clear one tank or Reset all tanks from the buttons under the tabs.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">3. Before delivery</h2>
          <p className="text-[var(--muted)]">
            Search and select the tank chart that matches the physical tag,
            choose 90% or 95% safe fill, optional product grade, enter the
            opening dip (cm) and planned delivery (L). The app shows volume and
            safe headroom. {SAFETY_REMINDER}
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">4. After delivery</h2>
          <p className="text-[var(--muted)]">
            Enter the closing dip. Review delivered volume and reconciliation,
            add location if needed, then Save. You can stay on the calculator
            and finish the other tank tabs.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">5. Offline (installable app)</h2>
          <p className="text-[var(--muted)]">
            Sign in once online, then install the app if offered. Charts you
            have opened are cached for offline calc. Saves made offline queue
            and upload when you reconnect. History needs a network connection.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">6. Subscribe</h2>
          <p className="text-[var(--muted)]">
            Use Subscribe during or after the trial ({MONTHLY_PRICE_LABEL}).
            After you pay, Billing opens the Stripe customer portal to manage
            payment method or cancel.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold">7. Share your link</h2>
          <p className="text-[var(--muted)]">
            Use Share on the calculator to send your personal signup link.
            Friends get the normal 7-day trial. You get 14 extra days of access
            when they subscribe.
          </p>
        </section>
      </div>

      <p className="mt-10 flex flex-wrap gap-4">
        <Link href="/login" className="text-sm font-bold text-[var(--accent)]">
          Back to sign in
        </Link>
        <Link href="/about" className="text-sm font-bold text-[var(--accent)]">
          About
        </Link>
      </p>
    </main>
  );
}
