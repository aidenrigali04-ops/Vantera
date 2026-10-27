import { CONNECTION_NOTE_MAX_CHARS, FOLLOWUP_MAX_CHARS } from "@vantera/agent-brains";
import { describe, expect, it } from "vitest";
import { buildQueueRows, pageSlice, type QueueSendIn } from "./queue";
import type { SenderFacts } from "./types";

const now = new Date("2026-10-26T15:00:00Z");
const sender = (id: string, name: string): SenderFacts => ({
  id,
  name,
  status: "active",
  ageDays: 60,
  invitesToday: 0,
  messagesToday: 0,
  invitesThisWeek: 0,
  statusChangedAt: null,
});
const senders = [sender("s1", "Anna K."), sender("s2", "Jonas M.")];

function send(id: string, o: Partial<QueueSendIn> & { score?: number; acct?: string | null } = {}): QueueSendIn {
  return {
    id,
    lead_id: o.lead_id === undefined ? `lead-${id}` : o.lead_id,
    body: "hi",
    style_flags: null,
    linkedin_stage: o.linkedin_stage ?? "invite",
    origin: o.origin ?? "sequence",
    created_at: "2026-10-26T10:00:00Z",
    leads: {
      id: `lead-${id}`,
      first_name: "Pat",
      last_name: id,
      title: "CEO",
      company_name: "Acme",
      location: null,
      ai_score: o.score ?? 50,
      status: null,
      linkedin_account_id: o.acct === undefined ? "s1" : o.acct,
      ai_insights: { triggers: ["t1", "t2", "t3"], pain_points: ["p1"] },
    },
  };
}
const base = { signals: [], downSenderIds: new Set<string>(), now, timeZone: "UTC", senders };

describe("buildQueueRows", () => {
  it("orders replies, then invites, then follow-ups, score desc inside", () => {
    const rows = buildQueueRows({
      ...base,
      limit: null,
      sends: [
        send("f-hi", { linkedin_stage: "message", score: 99 }),
        send("i-lo", { score: 10 }),
        send("i-hi", { score: 80 }),
        send("r", { origin: "reply_response", linkedin_stage: "message", score: 1 }),
      ],
    });
    expect(rows.map((r) => r.id)).toEqual(["r", "i-hi", "i-lo", "f-hi"]);
    expect(rows[0].origin).toBe("reply_response");
    expect(rows[1].origin).toBe("sequence");
  });

  it("derives step labels and char limits", () => {
    const m = (id: string, score: number) => send(id, { lead_id: "same", linkedin_stage: "message", score });
    const rows = buildQueueRows({
      ...base,
      limit: null,
      sends: [send("inv"), m("a", 90), m("b", 80), m("c", 70), m("d", 60), send("rep", { origin: "reply_response", linkedin_stage: "message" })],
    });
    expect(rows.map((r) => r.step)).toEqual(["Reply", "Invite", "Follow-up 1", "Follow-up 2", "Follow-up 3", "Follow-up 3"]);
    expect(rows.find((r) => r.step === "Invite")!.charLimit).toBe(CONNECTION_NOTE_MAX_CHARS);
    expect(rows.find((r) => r.step === "Follow-up 1")!.charLimit).toBe(FOLLOWUP_MAX_CHARS);
    expect(rows.find((r) => r.step === "Reply")!.charLimit).toBe(FOLLOWUP_MAX_CHARS);
  });

  it("flags rows whose sender is down as held", () => {
    const rows = buildQueueRows({
      ...base,
      limit: null,
      downSenderIds: new Set(["s2"]),
      sends: [send("ok", { acct: "s1", score: 90 }), send("down", { acct: "s2", score: 80 })],
    });
    expect(rows[0].sends).toMatchObject({ held: false, sender: "Anna K." });
    expect(rows[1].sends).toEqual({ label: "held", sender: "Jonas M.", held: true });
  });

  it("limit caps the rows; null returns all", () => {
    const sends = Array.from({ length: 8 }, (_, i) => send(`x${i}`, { score: i }));
    expect(buildQueueRows({ ...base, sends, limit: 5 })).toHaveLength(5);
    expect(buildQueueRows({ ...base, sends, limit: null })).toHaveLength(8);
  });

  it("evidence caps at 4 and a top signal is prepended with its glyph", () => {
    const rows = buildQueueRows({
      ...base,
      limit: null,
      sends: [send("a")],
      signals: [
        { lead_id: "lead-a", kind: "hiring_post", label: "Hiring SDRs", observed_at: "2026-10-26T12:00:00Z" },
        { lead_id: "lead-a", kind: "funding", label: "older", observed_at: "2026-10-01T12:00:00Z" },
      ],
    });
    expect(rows[0].signal).toMatchObject({ label: "Hiring SDRs", glyph: "briefcase" });
    expect(rows[0].evidence).toHaveLength(4);
    expect(rows[0].evidence[0].text).toBe("Hiring SDRs");
  });
});

describe("pageSlice", () => {
  const rows = [1, 2, 3, 4, 5];
  it("slices pages 1-based", () => {
    expect(pageSlice(rows, 1, 2)).toEqual([1, 2]);
    expect(pageSlice(rows, 2, 2)).toEqual([3, 4]);
    expect(pageSlice(rows, 3, 2)).toEqual([5]);
  });
  it("returns [] when out of range", () => {
    expect(pageSlice(rows, 4, 2)).toEqual([]);
  });
});
