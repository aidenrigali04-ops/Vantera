import { describe, expect, it } from "vitest";
import {
  FIRST_REJECT_KEY,
  REJECT_REASONS,
  REJECT_REASON_ORDER,
  markFirstRejectSeen,
  type RejectReason,
} from "./reject-reasons";

describe("REJECT_REASONS", () => {
  it("labels every reason in sentence case, in the chip order Wrong person · Bad timing · Weak message · Other", () => {
    expect(REJECT_REASON_ORDER.map((r) => REJECT_REASONS[r])).toEqual([
      "Wrong person",
      "Bad timing",
      "Weak message",
      "Other",
    ]);
  });

  it("covers exactly the four typed reasons", () => {
    const keys = Object.keys(REJECT_REASONS).sort();
    const expected: RejectReason[] = ["bad_timing", "other", "weak_message", "wrong_person"];
    expect(keys).toEqual(expected);
    expect(new Set(REJECT_REASON_ORDER).size).toBe(4);
  });
});

describe("markFirstRejectSeen", () => {
  function fakeStore(initial: Record<string, string> = {}) {
    const data = { ...initial };
    return {
      data,
      getItem: (k: string) => data[k] ?? null,
      setItem: (k: string, v: string) => {
        data[k] = v;
      },
    };
  }

  it("is true the first time and false afterwards, persisting under the vantera key", () => {
    const store = fakeStore();
    expect(markFirstRejectSeen(store)).toBe(true);
    expect(store.data[FIRST_REJECT_KEY]).toBeTruthy();
    expect(markFirstRejectSeen(store)).toBe(false);
  });

  it("is false when storage is unavailable or throws", () => {
    expect(markFirstRejectSeen(null)).toBe(false);
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {},
    };
    expect(markFirstRejectSeen(throwing)).toBe(false);
  });
});
