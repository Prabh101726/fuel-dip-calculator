import * as Sentry from "@sentry/nextjs";
import { SENTRY_DSN } from "@/lib/sentry/dsn";

Sentry.init({
  dsn: SENTRY_DSN,
  sendDefaultPii: false,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 0,
  enabled: process.env.NODE_ENV === "production",
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: process.env.NODE_ENV === "production" ? 1.0 : 0,
  // Browser-extension bridge noise (no stack; not our code).
  // e.g. "Object Not Found Matching Id:5, MethodName:update, ParamCount:4"
  ignoreErrors: [/Object Not Found Matching Id:\d+, MethodName:update, ParamCount:\d+/],
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
