import { APP_ORIGIN } from "@/lib/app-copy";

export const REFERRAL_SHARE_TITLE = "Fuel Dip Calculator";

export function referralSignupUrl(code: string): string {
  return `${APP_ORIGIN}/login?ref=${encodeURIComponent(code)}`;
}

export function referralSharePayload(url: string): ShareData {
  return { title: REFERRAL_SHARE_TITLE, url };
}

export async function shareOrCopyReferralUrl(
  url: string,
): Promise<"shared" | "copied"> {
  if (typeof navigator.share === "function") {
    await navigator.share(referralSharePayload(url));
    return "shared";
  }
  await navigator.clipboard.writeText(url);
  return "copied";
}
