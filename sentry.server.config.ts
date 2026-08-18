import * as Sentry from "@sentry/nextjs";
import { SENTRY_DSN } from "@/lib/sentry/dsn";

Sentry.init({
  dsn: SENTRY_DSN,
  sendDefaultPii: false,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 0,
  enabled: process.env.NODE_ENV === "production",
});
