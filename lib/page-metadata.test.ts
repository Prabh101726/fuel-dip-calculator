import { describe, expect, it } from "vitest";
import { APP_NAME, APP_ORIGIN, APP_TAGLINE } from "@/lib/app-copy";
import { pageMetadata } from "@/lib/page-metadata";

describe("app-copy share constants", () => {
  it("pins the public origin and name", () => {
    expect(APP_ORIGIN).toBe("https://fuel-dip-calculator.app");
    expect(APP_NAME).toBe("Fuel Dip Calculator");
    expect(APP_TAGLINE).toBe(
      "Safe discharge sheet for fuel delivery — dip chart volumes, ullage, and reconciliation.",
    );
  });
});

describe("pageMetadata", () => {
  it("returns title and description for a page", () => {
    const meta = pageMetadata("User guide", "Quick steps.");
    expect(meta).toEqual({ title: "User guide", description: "Quick steps." });
  });
});
