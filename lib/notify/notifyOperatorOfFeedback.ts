import * as Sentry from "@sentry/nextjs";
import { buildFeedbackEmail, type FeedbackNotifyInput } from "@/lib/notify/feedbackEmail";
import { sendOperatorEmail } from "@/lib/notify/sendOperatorEmail";

/**
 * Best-effort operator watch. The `feedback` row is already saved via RPC;
 * email / Sentry must not fail the driver's submit.
 */
export async function notifyOperatorOfFeedback(
  input: FeedbackNotifyInput,
): Promise<void> {
  const { subject, text } = buildFeedbackEmail(input);

  try {
    Sentry.captureFeedback({
      name: input.phone ?? "Driver",
      message: input.body,
      url: "https://fuel-dip-calculator.app/feedback",
      tags: {
        kind: "feedback",
        driver_id: input.driverId,
      },
    });
  } catch {
    /* SDK may be disabled in tests / local */
  }

  const email = await sendOperatorEmail({ subject, text });
  if (email === "failed") {
    try {
      Sentry.captureMessage("feedback operator email failed", {
        level: "warning",
        extra: { driverId: input.driverId },
      });
    } catch {
      /* SDK may be disabled */
    }
  }
}
