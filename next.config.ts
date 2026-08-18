import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { withSentryConfig } from "@sentry/nextjs";
import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";
import { SENTRY_ORG, SENTRY_PROJECT } from "./lib/sentry/dsn";

const revision =
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() ||
  crypto.randomUUID();

const packageVersion = (
  JSON.parse(readFileSync(join(__dirname, "package.json"), "utf-8")) as {
    version: string;
  }
).version;

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  reloadOnOnline: false,
  register: true,
  // Do not precache /calculator — middleware auth-gates it, so a first-visit
  // precache from /login can store login HTML under the /calculator key.
  // Runtime document caching covers the shell after the required online sign-in.
  additionalPrecacheEntries: [{ url: "/~offline", revision }],
});

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: packageVersion,
  },
};

export default withSentryConfig(withSerwist(nextConfig), {
  org: SENTRY_ORG,
  project: SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  telemetry: false,
  widenClientFileUpload: true,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
  webpack: {
    automaticVercelMonitors: true,
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
