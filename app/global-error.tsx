"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#12141a",
          color: "#f2f4f8",
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 24,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 22 }}>Something went wrong</h1>
        <p style={{ margin: 0, color: "#9aa3b2", textAlign: "center" }}>
          Reload the page. If this keeps happening, email contact@detours-app.com.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            minHeight: 48,
            padding: "0 16px",
            border: 0,
            borderRadius: 8,
            background: "#e8a317",
            color: "#12141a",
            fontWeight: 700,
            fontSize: 16,
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
