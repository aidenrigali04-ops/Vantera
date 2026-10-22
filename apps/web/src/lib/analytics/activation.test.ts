import { describe, expect, it } from "vitest";
import { markFirstDraftApproved, FIRST_DRAFT_APPROVED_KEY } from "./activation";

function fakeStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe("markFirstDraftApproved", () => {
  it("returns true only the first time", () => {
    const s = fakeStorage();
    expect(markFirstDraftApproved(s)).toBe(true);
    expect(markFirstDraftApproved(s)).toBe(false);
    expect(s.getItem(FIRST_DRAFT_APPROVED_KEY)).toBe("1");
  });
  it("uses the documented key", () => {
    expect(FIRST_DRAFT_APPROVED_KEY).toBe("vantera:first_draft_approved");
  });
  it("returns false when storage throws", () => {
    const bad = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(markFirstDraftApproved(bad)).toBe(false);
  });
});
