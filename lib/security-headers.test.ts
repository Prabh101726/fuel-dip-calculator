import { describe, expect, it } from "vitest";
import { SECURITY_HEADERS } from "@/lib/security-headers";

describe("SECURITY_HEADERS", () => {
  it("sets the four baseline headers", () => {
    const byKey = Object.fromEntries(
      SECURITY_HEADERS.map((h) => [h.key, h.value]),
    );
    expect(byKey["X-Content-Type-Options"]).toBe("nosniff");
    expect(byKey["X-Frame-Options"]).toBe("DENY");
    expect(byKey["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(byKey["Permissions-Policy"]).toBe(
      "camera=(), microphone=(), geolocation=()",
    );
    expect(SECURITY_HEADERS).toHaveLength(4);
  });

  it("does not duplicate Vercel's HSTS header", () => {
    expect(
      SECURITY_HEADERS.some(
        (h) => h.key.toLowerCase() === "strict-transport-security",
      ),
    ).toBe(false);
  });
});
