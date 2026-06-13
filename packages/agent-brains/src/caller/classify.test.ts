import { describe, expect, it, vi } from "vitest";
import { classifyOutcome, mapProviderDisposition } from "./classify";

describe("mapProviderDisposition", () => {
  it("maps obvious provider dispositions without an LLM call", () => {
    expect(mapProviderDisposition("no_answer")).toBe("no_answer");
    expect(mapProviderDisposition("voicemail")).toBe("voicemail");
    expect(mapProviderDisposition("unknown_thing")).toBeNull();
  });
});

describe("classifyOutcome", () => {
  it("returns the canonical outcome from the transcript", async () => {
    const generate = vi.fn(async () => ({ object: { outcome: "booked" } }));
    const out = await classifyOutcome("rep: ... prospect: yes book it", null as never, generate as never);
    expect(out).toBe("booked");
  });
});
