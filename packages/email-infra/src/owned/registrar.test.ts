import { describe, expect, it } from "vitest";
import { InMemoryRegistrar } from "./registrar";

describe("InMemoryRegistrar", () => {
  it("reports availability and records purchases", async () => {
    const r = new InMemoryRegistrar({ taken: ["taken.com"] });
    expect(await r.isAvailable("free.com")).toBe(true);
    expect(await r.isAvailable("taken.com")).toBe(false);
    await r.buy("free.com");
    expect(r.purchased).toContain("free.com");
    await expect(r.buy("taken.com")).rejects.toThrow(/unavailable/);
  });
});
