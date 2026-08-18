import { describe, expect, it } from "vitest";
import { mapFeedbackSubmitError } from "./submit";

describe("mapFeedbackSubmitError", () => {
  it("maps hourly throttle", () => {
    expect(mapFeedbackSubmitError({ code: "P0001", message: "limit" })).toBe(
      "Try again in an hour.",
    );
  });

  it("maps empty and too long", () => {
    expect(mapFeedbackSubmitError({ message: "empty" })).toBe(
      "Write a short message first.",
    );
    expect(mapFeedbackSubmitError({ message: "too long" })).toBe(
      "Keep it under 2000 characters.",
    );
  });

  it("returns empty for null", () => {
    expect(mapFeedbackSubmitError(null)).toBe("");
  });
});
