import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("accepts same-origin relative paths", () => {
    expect(safeNext("/invite/abc-123")).toBe("/invite/abc-123");
    expect(safeNext("/dashboard?view=pipeline")).toBe("/dashboard?view=pipeline");
  });

  it("rejects absolute and protocol-relative URLs (open-redirect guard)", () => {
    expect(safeNext("https://evil.example")).toBeNull();
    expect(safeNext("//evil.example")).toBeNull();
    expect(safeNext("/\\evil.example")).toBeNull();
    expect(safeNext("/foo://bar")).toBeNull();
  });

  it("rejects empty and non-string input", () => {
    expect(safeNext("")).toBeNull();
    expect(safeNext(undefined)).toBeNull();
    expect(safeNext(null)).toBeNull();
    expect(safeNext("dashboard")).toBeNull();
  });
});
