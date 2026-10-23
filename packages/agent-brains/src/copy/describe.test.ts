import { describe, expect, it } from "vitest";
import { describeStrategy } from "./describe";

describe("describeStrategy", () => {
  it("labels a strategy in plain English", () => {
    expect(describeStrategy({ followupLength: "tight" })).toContain("tighter");
  });
  it("handles an empty strategy", () => {
    expect(describeStrategy({})).toBe("the current approach");
  });
  it("describes an openerAngle strategy in plain words (Stage 1b)", () => {
    expect(describeStrategy({ openerAngle: "a peer just solved this pain" })).toBe(
      'open with the angle "a peer just solved this pain"'
    );
  });
});
