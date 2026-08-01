import { describe, expect, it } from "vitest";
import { needsDraftHydrationAfterUnlock } from "./needsDraftHydrationAfterUnlock";

describe("needsDraftHydrationAfterUnlock", () => {
  it("hydrates when drafts were never applied (blocked paint path)", () => {
    expect(
      needsDraftHydrationAfterUnlock({ draftsAlreadyReady: false }),
    ).toBe(true);
  });

  it("skips when drafts already hydrated from normal paint", () => {
    expect(
      needsDraftHydrationAfterUnlock({ draftsAlreadyReady: true }),
    ).toBe(false);
  });
});
