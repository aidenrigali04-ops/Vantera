import { describe, expect, it } from "vitest";
import { estimateReadyInDays, shapeWarmupStatus } from "./warmup-status";

describe("estimateReadyInDays", () => {
  const now = new Date("2026-06-15T00:00:00Z");
  it("returns remaining days from warmup start over the standard window", () => {
    expect(estimateReadyInDays(new Date("2026-06-11T00:00:00Z"), now)).toBe(17); // 21 - 4
  });
  it("clamps to 0 once the window has elapsed", () => {
    expect(estimateReadyInDays(new Date("2026-05-01T00:00:00Z"), now)).toBe(0);
  });
  it("null start → null (unknown)", () => {
    expect(estimateReadyInDays(null, now)).toBeNull();
  });
});

describe("shapeWarmupStatus", () => {
  it("derives phase, ready counts, and live channels", () => {
    const dto = shapeWarmupStatus({
      mailboxes: [
        { status: "active", warmupStartedAt: null },
        { status: "warming", warmupStartedAt: new Date("2026-06-11T00:00:00Z") },
      ],
      linkedinConnected: true,
      now: new Date("2026-06-15T00:00:00Z"),
    });
    expect(dto.emailPhase).toBe("warming");
    expect(dto.mailboxesReady).toBe(1);
    expect(dto.mailboxesTotal).toBe(2);
    expect(dto.linkedinConnected).toBe(true);
    expect(dto.channelsLiveNow).toContain("linkedin");
  });
  it("all mailboxes active → ready phase, estReadyInDays 0", () => {
    const dto = shapeWarmupStatus({
      mailboxes: [{ status: "active", warmupStartedAt: null }],
      linkedinConnected: false,
      now: new Date("2026-06-15T00:00:00Z"),
    });
    expect(dto.emailPhase).toBe("ready");
    expect(dto.estReadyInDays).toBe(0);
    expect(dto.channelsLiveNow).toContain("email");
  });
});
