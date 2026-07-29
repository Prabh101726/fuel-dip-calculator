import type { SupabaseClient } from "@supabase/supabase-js";
import {
  deleteOutboxItem,
  isAuthErrorStatus,
  isClientRejectStatus,
  isNetworkLikeError,
  listOutbox,
  markOutboxFailed,
  type OutboxItem,
} from "./db";

export type FlushResult = {
  synced: number;
  failed: number;
  remaining: number;
  errors: string[];
};

/**
 * Flush pending outbox items in createdAt order.
 * Network errors: leave pending for retry.
 * Auth 401: refresh session once and retry that item.
 * Other 4xx / validation: mark failed (poison) and continue.
 */
export async function flushOutbox(
  supabase: SupabaseClient,
  options?: { refreshSession?: () => Promise<void> },
): Promise<FlushResult> {
  const items = (await listOutbox()).filter((i) => i.status === "pending");
  let synced = 0;
  let failed = 0;
  const errors: string[] = [];
  let refreshed = false;

  for (const item of items) {
    let outcome = await tryInsert(supabase, item);

    if (
      outcome !== "ok" &&
      outcome.kind === "auth" &&
      !refreshed &&
      options?.refreshSession
    ) {
      try {
        await options.refreshSession();
        refreshed = true;
        outcome = await tryInsert(supabase, item);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(msg);
        break;
      }
    }

    if (outcome === "ok") {
      await deleteOutboxItem(item.id);
      synced += 1;
      continue;
    }

    if (outcome.kind === "reject") {
      await markOutboxFailed(item.id, outcome.message);
      failed += 1;
      errors.push(outcome.message);
      continue;
    }

    // network or unresolved auth — stop; leave remaining pending
    errors.push(outcome.message);
    break;
  }

  const remaining = (await listOutbox()).filter((i) => i.status === "pending")
    .length;
  return { synced, failed, remaining, errors: errors.filter(Boolean) };
}

type InsertOutcome =
  | "ok"
  | { kind: "network"; message: string }
  | { kind: "auth"; message: string }
  | { kind: "reject"; message: string };

async function tryInsert(
  supabase: SupabaseClient,
  item: OutboxItem,
): Promise<InsertOutcome> {
  try {
    const { error } = await supabase.from("dip_calculations").insert(item.payload);
    if (!error) return "ok";
    const status = (error as { status?: number }).status;
    const message = error.message || "Save failed";
    if (isAuthErrorStatus(status) || /JWT|session|auth/i.test(message)) {
      return { kind: "auth", message };
    }
    if (
      isClientRejectStatus(status) ||
      /row-level security|violates|check constraint|duplicate|invalid/i.test(
        message,
      )
    ) {
      return { kind: "reject", message };
    }
    if (isNetworkLikeError(error) || /network|fetch/i.test(message)) {
      return { kind: "network", message };
    }
    // Default non-network API errors as poison so the queue cannot wedge
    return { kind: "reject", message };
  } catch (err) {
    if (isNetworkLikeError(err)) {
      return {
        kind: "network",
        message: err instanceof Error ? err.message : String(err),
      };
    }
    return {
      kind: "reject",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
