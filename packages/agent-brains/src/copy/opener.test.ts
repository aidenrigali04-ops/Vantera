import { describe, expect, it } from "vitest";
import { findRepeatedOpener, openerSkeleton, openerSkeletons, stripIdentity } from "./opener";

describe("stripIdentity", () => {
  it("removes the prospect's name and company and tidies punctuation", () => {
    expect(stripIdentity("Thanks for connecting, Sarah. Curious how Acme handles it?", "Sarah Lee Acme")).toBe(
      "Thanks for connecting. Curious how handles it?"
    );
  });

  it("is a no-op without identity", () => {
    expect(stripIdentity("  Saw the new bay opening. ", null)).toBe("Saw the new bay opening.");
  });

  it("only strips whole words", () => {
    expect(stripIdentity("Annual planning season", "Ann")).toBe("Annual planning season");
  });
});

describe("openerSkeleton", () => {
  it("takes the first five normalized words, identity stripped", () => {
    expect(openerSkeleton("Thanks for connecting, Sarah! Curious how you're handling outbound?", "Sarah Lee")).toBe(
      "thanks for connecting curious how"
    );
  });

  it("renaming the prospect does not change the skeleton", () => {
    const a = openerSkeleton("Thanks for connecting Tom. Curious how Northwind runs outbound?", "Tom Hale Northwind");
    const b = openerSkeleton("Thanks for connecting Priya. Curious how Wrenfield runs outbound?", "Priya Nandan Wrenfield");
    expect(a).toBe(b);
  });
});

describe("findRepeatedOpener", () => {
  const recent = ["thanks for connecting curious how"];

  it("flags a follow-up whose first five words match a recent skeleton", () => {
    const v = findRepeatedOpener("Thanks for connecting, Dana. Curious how the team ramps?", recent, "Dana Reed Acme");
    expect(v).toHaveLength(1);
    expect(v[0]!.rule).toBe("repeated-opener");
  });

  it("passes a follow-up that opens differently", () => {
    expect(findRepeatedOpener("Four new AEs in a month is a big class. What slows them most?", recent, "Dana")).toEqual([]);
  });

  it("matches on the shared prefix when the recent opener is short", () => {
    expect(findRepeatedOpener("Saw the new bay opening, how's intake going?", ["saw the new"])).toHaveLength(1);
  });

  it("ignores skeletons too short to be a template", () => {
    expect(findRepeatedOpener("Hi there, how is the launch going?", ["hi there"])).toEqual([]);
    expect(findRepeatedOpener("Hi", recent)).toEqual([]);
  });

  it("handles absent lists", () => {
    expect(findRepeatedOpener("Thanks for connecting, curious how", undefined)).toEqual([]);
  });
});

describe("openerSkeletons", () => {
  it("dedupes and drops trivial openers", () => {
    expect(
      openerSkeletons(["Thanks for connecting. Curious how you run it?", "thanks for connecting, curious how it goes", "Hi"])
    ).toEqual(["thanks for connecting curious how"]);
  });
});
