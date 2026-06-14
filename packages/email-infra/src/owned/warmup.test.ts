import { describe, expect, it } from "vitest";
import { InMemoryWarmup } from "./warmup";

describe("InMemoryWarmup", () => {
  it("enrolls a mailbox and reports warming then ready", async () => {
    const w = new InMemoryWarmup();
    await w.enroll("sdr0@acme.com");
    expect(await w.status("sdr0@acme.com")).toEqual({ phase: "warming", dailyCap: 10 });
    w.markReady("sdr0@acme.com", 50);
    expect(await w.status("sdr0@acme.com")).toEqual({ phase: "ready", dailyCap: 50 });
  });
});
