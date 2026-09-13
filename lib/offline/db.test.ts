import { describe, expect, it } from "vitest";
import {
  blankCalculatorDraft,
  blankSlotDraft,
  isAuthErrorStatus,
  isClientRejectStatus,
  isIdbConnectionError,
  isNetworkLikeError,
  isTrialExpired,
} from "./db";

describe("offline helpers", () => {
  it("blank draft has four empty slots", () => {
    const draft = blankCalculatorDraft(4);
    expect(draft.slots).toHaveLength(4);
    expect(draft.slots[0]).toEqual(blankSlotDraft());
  });

  it("detects expired trial timestamps", () => {
    expect(isTrialExpired("2000-01-01T00:00:00.000Z")).toBe(true);
    expect(isTrialExpired("2099-01-01T00:00:00.000Z")).toBe(false);
    expect(isTrialExpired(null)).toBe(false);
  });

  it("classifies auth vs client reject statuses", () => {
    expect(isAuthErrorStatus(401)).toBe(true);
    expect(isAuthErrorStatus(403)).toBe(true);
    expect(isClientRejectStatus(400)).toBe(true);
    expect(isClientRejectStatus(422)).toBe(true);
    expect(isClientRejectStatus(500)).toBe(false);
  });

  it("treats TypeError as network-like", () => {
    expect(isNetworkLikeError(new TypeError("Failed to fetch"))).toBe(true);
  });

  it("detects Safari IDB connection-closing and UnknownError cases", () => {
    expect(
      isIdbConnectionError(
        new DOMException(
          "Failed to execute 'transaction' on 'IDBDatabase': The database connection is closing.",
          "InvalidStateError",
        ),
      ),
    ).toBe(true);
    expect(
      isIdbConnectionError(
        new DOMException(
          "An internal error was encountered in the Indexed Database server",
          "UnknownError",
        ),
      ),
    ).toBe(true);
    expect(isIdbConnectionError(new Error("Failed to fetch"))).toBe(false);
  });
});
