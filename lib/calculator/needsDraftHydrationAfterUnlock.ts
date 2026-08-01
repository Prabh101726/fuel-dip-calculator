/**
 * After a blocked cache paint, refreshOnline may unlock access.
 * Drafts were skipped on the blocked path — hydrate before showing the form.
 */
export function needsDraftHydrationAfterUnlock(input: {
  draftsAlreadyReady: boolean;
}): boolean {
  return !input.draftsAlreadyReady;
}
