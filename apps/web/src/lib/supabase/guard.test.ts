import { describe, expect, it } from "vitest";
import { orThrow } from "./guard";

describe("orThrow", () => {
  it("returns data when there is no error", () => {
    expect(orThrow({ data: [1, 2], error: null }, "leads")).toEqual([1, 2]);
  });

  it("passes null data through when there is no error (maybeSingle case)", () => {
    expect(orThrow<{ id: string } | null>({ data: null, error: null }, "account")).toBeNull();
  });

  it("throws a labeled error instead of letting a failure render as empty", () => {
    expect(() => orThrow({ data: null, error: { message: "connection refused" } }, "leads")).toThrow(
      /Failed to load leads: connection refused/
    );
  });
});
