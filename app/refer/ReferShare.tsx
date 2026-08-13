"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { referralSignupUrl, shareOrCopyReferralUrl } from "@/lib/referral/share";

export default function ReferShare() {
  const [status, setStatus] = useState<"loading" | "signedOut" | "ready" | "error">(
    "loading",
  );
  const [url, setUrl] = useState<string | null>(null);
  const [flash, setFlash] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        setStatus("signedOut");
        return;
      }
      const { data } = await supabase
        .from("drivers")
        .select("referral_code")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const code =
        typeof data?.referral_code === "string" ? data.referral_code : null;
      if (!code) {
        setStatus("error");
        return;
      }
      setUrl(referralSignupUrl(window.location.origin, code));
      setStatus("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onShare() {
    if (!url) return;
    try {
      const result = await shareOrCopyReferralUrl(url);
      if (result === "copied") {
        setFlash("Link copied");
        window.setTimeout(() => setFlash(""), 2500);
      }
    } catch {
      /* user cancelled native share */
    }
  }

  if (status === "loading") {
    return <p className="text-sm text-[var(--muted)]">Loading your link…</p>;
  }

  if (status === "signedOut") {
    return (
      <p>
        <Link
          href="/login?next=/refer"
          className="inline-flex min-h-12 items-center rounded-lg bg-[var(--accent)] px-4 text-base font-bold text-[var(--accent-fg)]"
        >
          Sign in to get your link
        </Link>
      </p>
    );
  }

  if (status === "error" || !url) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Could not load your referral link. Open the calculator once online, then
        come back here.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="break-all rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-[var(--text)]">
        {url}
      </p>
      <button
        type="button"
        onClick={() => void onShare()}
        className="min-h-12 rounded-lg bg-[var(--accent)] px-4 text-base font-bold text-[var(--accent-fg)]"
      >
        Share
      </button>
      {flash !== "" && (
        <p className="text-sm font-medium text-[var(--success)]" role="status">
          {flash}
        </p>
      )}
    </div>
  );
}
