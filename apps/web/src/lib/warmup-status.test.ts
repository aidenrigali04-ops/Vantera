import { describe, expect, it } from "vitest";
import {
  estimateReadyInDays,
  shapeWarmupStatus,
  summarizeChannelReadiness,
  type WarmupStatus,
} from "./warmup-status";

function warmup(overrides: Partial<WarmupStatus> = {}): WarmupStatus {
  return {
    emailPhase: "warming",
    estReadyInDays: null,
    mailboxesReady: 0,
    mailboxesTotal: 0,
    linkedinConnected: false,
    channelsLiveNow: [],
    ...overrides,
  };
}

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

describe("summarizeChannelReadiness", () => {
  it("nothing set up → no channel live, not ready to send", () => {
    const s = summarizeChannelReadiness(warmup());
    expect(s.channelsLive).toBe(0);
    expect(s.channelsTotal).toBe(2);
    expect(s.readyToSend).toBe(false);
    expect(s.linkedin).toBe("off");
    expect(s.email).toBe("off");
    expect(s.emailEtaDays).toBeNull();
  });

  it("LinkedIn active + email warming → one channel live, carries email ETA", () => {
    const s = summarizeChannelReadiness(
      warmup({ linkedinConnected: true, mailboxesTotal: 2, estReadyInDays: 12, channelsLiveNow: ["linkedin"] })
    );
    expect(s.channelsLive).toBe(1);
    expect(s.readyToSend).toBe(true);
    expect(s.linkedin).toBe("active");
    expect(s.email).toBe("warming");
    expect(s.emailEtaDays).toBe(12);
  });

  it("email ready but LinkedIn off → one channel live via email", () => {
    const s = summarizeChannelReadiness(
      warmup({ mailboxesReady: 1, mailboxesTotal: 1, emailPhase: "ready", estReadyInDays: 0, channelsLiveNow: ["email"] })
    );
    expect(s.channelsLive).toBe(1);
    expect(s.email).toBe("ready");
    expect(s.linkedin).toBe("off");
    expect(s.emailEtaDays).toBeNull();
  });

  it("both channels live → fully ready", () => {
    const s = summarizeChannelReadiness(
      warmup({
        linkedinConnected: true,
        mailboxesReady: 2,
        mailboxesTotal: 2,
        emailPhase: "ready",
        channelsLiveNow: ["linkedin", "email"],
      })
    );
    expect(s.channelsLive).toBe(2);
    expect(s.readyToSend).toBe(true);
  });
});
