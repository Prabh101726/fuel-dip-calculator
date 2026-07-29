import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  enqueueOutbox,
  getOfflineDb,
  listOutbox,
  resetOfflineDbForTests,
} from "./db";
import { flushOutbox } from "./flushOutbox";

function mockSupabase(insertImpl: (payload: unknown) => Promise<{ error: { message: string; status?: number } | null }>) {
  return {
    from: () => ({
      insert: (payload: unknown) => insertImpl(payload),
    }),
  } as never;
}

describe("flushOutbox", () => {
  beforeEach(async () => {
    resetOfflineDbForTests();
    // Use a unique DB name would be better; delete all stores via open
    const db = await getOfflineDb();
    await db.clear("outbox");
  });

  it("deletes items that insert successfully", async () => {
    await enqueueOutbox({ company_id: "c1" });
    const supabase = mockSupabase(async () => ({ error: null }));
    const result = await flushOutbox(supabase);
    expect(result.synced).toBe(1);
    expect(result.remaining).toBe(0);
    expect(await listOutbox()).toHaveLength(0);
  });

  it("marks poison (client reject) failed and continues", async () => {
    await enqueueOutbox({ bad: true });
    await enqueueOutbox({ good: true });
    let calls = 0;
    const supabase = mockSupabase(async () => {
      calls += 1;
      if (calls === 1) {
        return { error: { message: "violates check constraint", status: 400 } };
      }
      return { error: null };
    });
    const result = await flushOutbox(supabase);
    expect(result.failed).toBe(1);
    expect(result.synced).toBe(1);
    const left = await listOutbox();
    expect(left).toHaveLength(1);
    expect(left[0].status).toBe("failed");
  });

  it("stops on network error and leaves item pending", async () => {
    await enqueueOutbox({ a: 1 });
    const supabase = mockSupabase(async () => {
      throw new TypeError("Failed to fetch");
    });
    const result = await flushOutbox(supabase);
    expect(result.synced).toBe(0);
    expect(result.remaining).toBe(1);
    const left = await listOutbox();
    expect(left[0].status).toBe("pending");
  });

  it("refreshes session once on auth error then retries", async () => {
    await enqueueOutbox({ a: 1 });
    let calls = 0;
    const refresh = vi.fn(async () => undefined);
    const supabase = mockSupabase(async () => {
      calls += 1;
      if (calls === 1) {
        return { error: { message: "JWT expired", status: 401 } };
      }
      return { error: null };
    });
    const result = await flushOutbox(supabase, { refreshSession: refresh });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(result.synced).toBe(1);
    expect(result.remaining).toBe(0);
  });
});
