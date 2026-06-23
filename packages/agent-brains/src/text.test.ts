import { describe, expect, it } from "vitest";
import { stripLoneSurrogates } from "./text";

describe("stripLoneSurrogates", () => {
  it("removes an unpaired high surrogate", () => {
    expect(stripLoneSurrogates("hi \uD800 there")).toBe("hi  there");
  });
  it("removes an unpaired low surrogate (the case that 400'd the API)", () => {
    expect(stripLoneSurrogates("hi \uDC00 there")).toBe("hi  there");
  });
  it("keeps valid surrogate pairs (real emoji)", () => {
    expect(stripLoneSurrogates("ok 😀 done")).toBe("ok 😀 done"); // 😀
  });
  it("leaves plain text untouched", () => {
    expect(stripLoneSurrogates("hello world")).toBe("hello world");
  });
});
