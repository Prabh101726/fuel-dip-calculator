import { describe, expect, it } from "vitest";
import { isStaleTankPointsResponse } from "./isStaleTankPointsResponse";

describe("isStaleTankPointsResponse", () => {
  it("treats a response as stale when selection moved to another tank", () => {
    expect(isStaleTankPointsResponse("tank-a", "tank-b")).toBe(true);
  });

  it("treats a response as stale when selection was cleared", () => {
    expect(isStaleTankPointsResponse("tank-a", null)).toBe(true);
  });

  it("accepts a response for the still-selected tank", () => {
    expect(isStaleTankPointsResponse("tank-a", "tank-a")).toBe(false);
  });
});
