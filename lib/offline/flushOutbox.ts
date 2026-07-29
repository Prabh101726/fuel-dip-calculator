import type { SupabaseClient } from "@supabase/supabase-js";
import {
  deleteOutboxItem,
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
    // PostgrestError exposes `code` / `message`, not an HTTP status field —
    // classify on message (and optional code). Default reject so the queue
    // cannot wedge on unknown server errors.
    const code = (error as { code?: string }).code ?? "";
    const message = error.message || "Save failed";
    if (
      /JWT|session|auth|expired/i.test(message) ||
      code === "PGRST301"
    ) {
      return { kind: "auth", message };
    }
    if (
      /row-level security|violates|check constraint|duplicate|invalid/i.test(
        message,
      ) ||
      code === "42501" ||
      code === "23514" ||
      code === "23505"
    ) {
      return { kind: "reject", message };
    }
    if (isNetworkLikeError(error) || /network|fetch/i.test(message)) {
      return { kind: "network", message };
    }
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
