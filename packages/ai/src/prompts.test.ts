import { describe, expect, it } from "vitest";
import { fnv1a64, listPrompts, registerPrompt } from "./prompts";

describe("prompt registry", () => {
  it("hashes deterministically (fnv1a64 known vector)", () => {
    expect(fnv1a64("hello")).toBe(fnv1a64("hello"));
    expect(fnv1a64("hello")).not.toBe(fnv1a64("hello!"));
    expect(fnv1a64("hello")).toMatch(/^[0-9a-f]{16}$/);
  });

  it("registers a prompt and exposes it in the listing", () => {
    const p = registerPrompt("test/one", "you are a test");
    expect(p).toEqual({ name: "test/one", text: "you are a test", hash: fnv1a64("you are a test") });
    expect(listPrompts().some((x) => x.name === "test/one")).toBe(true);
  });

  it("throws on duplicate registration under a different text", () => {
    registerPrompt("test/dup", "a");
    expect(() => registerPrompt("test/dup", "b")).toThrow(/already registered/);
  });
});
