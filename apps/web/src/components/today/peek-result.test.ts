import { describe, expect, it } from "vitest";
import { applyIfCurrent } from "./peek-result";

describe("applyIfCurrent", () => {
  it("applies a result for the draft that is still open", () => {
    const result = { sendId: "d1", body: "new text", styleFlags: null };
    expect(applyIfCurrent("d1", result)).toBe(result);
  });

  it("drops a result whose draft is no longer open (moved on while regenerating)", () => {
    expect(applyIfCurrent("d2", { sendId: "d1", body: "stale" })).toBeNull();
  });

  it("drops a result when the peek has closed", () => {
    expect(applyIfCurrent(null, { sendId: "d1", body: "stale" })).toBeNull();
  });
});
