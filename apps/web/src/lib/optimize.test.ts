import { describe, expect, it } from "vitest";
import { countInterestedSince } from "./optimize";

describe("countInterestedSince", () => {
  const interested = [
    { lead_id: "a", received_at: "2026-07-10T00:00:00Z" },
    { lead_id: "a", received_at: "2026-07-12T00:00:00Z" }, // same lead twice → 1
    { lead_id: "b", received_at: "2026-07-01T00:00:00Z" }, // before adoption → excluded
    { lead_id: "c", received_at: "2026-07-13T00:00:00Z" }, // lead not in stamped set → excluded
  ];

  it("counts distinct stamped leads with an interested reply after adoption", () => {
    expect(countInterestedSince(new Set(["a", "b"]), interested, "2026-07-05T00:00:00Z")).toBe(1);
  });

  it("null concludedAt counts all stamped interested leads", () => {
    expect(countInterestedSince(new Set(["a", "b"]), interested, null)).toBe(2);
  });
});
