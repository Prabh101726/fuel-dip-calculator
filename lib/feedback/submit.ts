export function mapFeedbackSubmitError(
  error: { code?: string; message?: string } | null,
): string {
  if (!error) return "";
  if (error.code === "P0001") return "Try again in an hour.";
  if (error.message?.includes("empty")) return "Write a short message first.";
  if (error.message?.includes("too long")) {
    return "Keep it under 2000 characters.";
  }
  return error.message || "Could not send feedback.";
}
