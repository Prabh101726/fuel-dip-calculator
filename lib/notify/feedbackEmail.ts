export const DEFAULT_RESEND_FROM =
  "Fuel Dip Calculator <contact@detours-app.com>";

export type FeedbackNotifyInput = {
  driverId: string;
  phone: string | null;
  body: string;
};

export function buildFeedbackEmail(input: FeedbackNotifyInput): {
  subject: string;
  text: string;
} {
  const who = input.phone || input.driverId;
  return {
    subject: `Fuel Dip feedback from ${who}`,
    text: [
      "New in-app feedback (also stored in table public.feedback).",
      "",
      `Driver id: ${input.driverId}`,
      `Phone: ${input.phone ?? "(none)"}`,
      "",
      input.body,
    ].join("\n"),
  };
}
