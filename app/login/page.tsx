import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "./LoginForm";
import {
  APP_NAME,
  APP_TAGLINE,
  MONTHLY_PRICE_LABEL,
  TRIAL_DAYS,
} from "@/lib/app-copy";

export const metadata: Metadata = {
  title: { absolute: APP_NAME },
  description: `${APP_TAGLINE} ${TRIAL_DAYS}-day free trial, then ${MONTHLY_PRICE_LABEL}.`,
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-12 text-sm text-[var(--muted)]">
          Loading…
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
