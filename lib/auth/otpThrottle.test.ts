import { describe, expect, it } from "vitest";
import { mapOtpThrottleError } from "./otpThrottle";

describe("mapOtpThrottleError", () => {
  it("returns ok when error is null", () => {
    expect(mapOtpThrottleError(null)).toEqual({ ok: true });
  });

  it("maps cooldown", () => {
    expect(
      mapOtpThrottleError({
        code: "P0001",
        message: "otp_cooldown",
        hint: "Please wait a moment before requesting another code.",
      }),
    ).toEqual({
      ok: false,
      reason: "cooldown",
      message: "Please wait a moment before requesting another code.",
    });
  });

  it("maps invalid phone", () => {
    const r = mapOtpThrottleError({
      code: "P0001",
      message: "invalid phone",
      hint: "Enter a valid international phone number.",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid");
  });

  it("maps hourly and daily limits", () => {
    expect(
      mapOtpThrottleError({ code: "P0002", message: "otp_hourly_limit" }).ok,
    ).toBe(false);
    expect(
      mapOtpThrottleError({ code: "P0003", message: "otp_daily_limit" }).ok,
    ).toBe(false);
  });

  it("fails open on unknown errors", () => {
    expect(mapOtpThrottleError({ code: "XX000", message: "weird" })).toEqual({
      ok: true,
    });
  });
});
