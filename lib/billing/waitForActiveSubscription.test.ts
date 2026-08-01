import { describe, expect, it, vi } from "vitest";
import { waitForActiveSubscription } from "./waitForActiveSubscription";
import { isActiveSubscriptionStatus } from "./access";

describe("waitForActiveSubscription", () => {
  it("returns true immediately when already active", async () => {
    const fetchStatus = vi.fn().mockResolvedValue("active");
    const ok = await waitForActiveSubscription(fetchStatus, {
      timeoutMs: 1000,
      intervalMs: 50,
    });
    expect(ok).toBe(true);
    expect(fetchStatus).toHaveBeenCalledTimes(1);
  });

  it("polls until status becomes active", async () => {
    const fetchStatus = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce("active");
    const ok = await waitForActiveSubscription(fetchStatus, {
      timeoutMs: 2000,
      intervalMs: 10,
    });
    expect(ok).toBe(true);
    expect(fetchStatus.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("returns false when timeout elapses without active status", async () => {
    const fetchStatus = vi.fn().mockResolvedValue(null);
    const ok = await waitForActiveSubscription(fetchStatus, {
      timeoutMs: 40,
      intervalMs: 10,
    });
    expect(ok).toBe(false);
    expect(isActiveSubscriptionStatus(null)).toBe(false);
  });
});
