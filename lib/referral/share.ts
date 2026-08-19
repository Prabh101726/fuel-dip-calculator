import { APP_ORIGIN } from "@/lib/app-copy";

export const REFERRAL_SHARE_TITLE = "Fuel Dip Calculator";
export const REFERRAL_SHARE_TEXT =
  "Fuel Dip Calculator — 7-day trial. If you subscribe, I get 14 extra days.";

export function referralSignupUrl(code: string): string {
  return `${APP_ORIGIN}/login?ref=${encodeURIComponent(code)}`;
}

export async function shareOrCopyReferralUrl(
  url: string,
): Promise<"shared" | "copied"> {
  if (typeof navigator.share === "function") {
    await navigator.share({
      title: REFERRAL_SHARE_TITLE,
      text: REFERRAL_SHARE_TEXT,
      url,
    });
    return "shared";
  }
  await navigator.clipboard.writeText(url);
  return "copied";
}
