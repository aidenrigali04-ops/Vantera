import { describe, expect, it } from "vitest";
import { visibleBlocks } from "./gate";

describe("visibleBlocks — dollars gate only dollars", () => {
  it("shows nothing but the empty state with no prospects", () => {
    expect(visibleBlocks({ found: 0, hasValue: true, hasSpend: true })).toEqual({
      funnel: false,
      sources: false,
      dollars: false,
      dollarsHint: null,
    });
  });

  it("shows the funnel and table without a deal value, hinting at the value", () => {
    expect(visibleBlocks({ found: 3, hasValue: false, hasSpend: false })).toEqual({
      funnel: true,
      sources: true,
      dollars: false,
      dollarsHint: "value",
    });
  });

  it("asks for the value first even when a plan exists", () => {
    expect(visibleBlocks({ found: 3, hasValue: false, hasSpend: true }).dollarsHint).toBe("value");
  });

  it("hints at a plan when the value is set but there is no spend", () => {
    expect(visibleBlocks({ found: 3, hasValue: true, hasSpend: false })).toEqual({
      funnel: true,
      sources: true,
      dollars: false,
      dollarsHint: "spend",
    });
  });

  it("shows dollars once value and spend are both present", () => {
    expect(visibleBlocks({ found: 3, hasValue: true, hasSpend: true })).toEqual({
      funnel: true,
      sources: true,
      dollars: true,
      dollarsHint: null,
    });
  });
});
