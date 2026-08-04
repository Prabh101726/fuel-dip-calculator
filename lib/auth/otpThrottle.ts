export type OtpThrottleReason = "cooldown" | "hourly" | "daily" | "invalid" | "unknown";

export type OtpThrottleResult =
  | { ok: true }
  | { ok: false; reason: OtpThrottleReason; message: string };

/**
 * Map PostgREST / Postgres error shapes from `request_otp_throttle` into a
 * discriminated result. Unknown shapes fail open so a broken RPC never
 * blocks legitimate OTP sends.
 */
export function mapOtpThrottleError(error: {
  code?: string;
  message?: string;
  hint?: string;
} | null): OtpThrottleResult {
  if (!error) return { ok: true };
  const code = error.code ?? "";
  const message = error.message ?? "";
  const friendly = error.hint || message || "";

  if (code === "P0001" && message === "otp_cooldown") {
    return {
      ok: false,
      reason: "cooldown",
      message: friendly || "Please wait a moment before requesting another code.",
    };
  }
  if (code === "P0001") {
    return {
      ok: false,
      reason: "invalid",
      message: friendly || "Enter a valid Canada / US phone number.",
    };
  }
  if (code === "P0002") {
    return {
      ok: false,
      reason: "hourly",
      message: friendly || "Too many codes sent. Try again in about an hour.",
    };
  }
  if (code === "P0003") {
    return {
      ok: false,
      reason: "daily",
      message: friendly || "Daily limit reached. Try again tomorrow.",
    };
  }
  // Fail open for unexpected shapes
  return { ok: true };
}
