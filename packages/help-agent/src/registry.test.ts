import { describe, expect, it } from "vitest";
import { assertApproved, requiresConfirmation } from "./registry";

describe("tier enforcement", () => {
  it("mutate/critical need approval; read/navigate don't", () => {
    expect(requiresConfirmation("read")).toBe(false);
    expect(requiresConfirmation("navigate")).toBe(false);
    expect(requiresConfirmation("mutate")).toBe(true);
    expect(requiresConfirmation("critical")).toBe(true);
    expect(() => assertApproved("mutate", false)).toThrow(/confirmation/);
    expect(() => assertApproved("mutate", true)).not.toThrow();
    expect(() => assertApproved("read", false)).not.toThrow();
  });
});
