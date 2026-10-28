import { describe, expect, it } from "vitest";
import { buildProof } from "./build";
import { agentRows, leadSets, sourceRows, watchCategory } from "./sources";
import { empty, lead } from "./fixtures";
import type { ProofInput } from "./types";

const watch = {
  keywords: ["Revenue Ops"], competitors: ["Acme"], creators: ["https://www.linkedin.com/in/jane-doe"], hashtags: ["#ai"],
};
const rowOf = (i: ProofInput, key: string) => buildProof(i).sources.find((r) => r.key === key)!;

describe("sources", () => {
  it("a lead counts once per row, duplicates collapse", () => {
    const i: ProofInput = {
      ...empty(), watch,
      leads: [lead("A"), lead("B"), lead("C")],
      signals: [
        { lead_id: "A", kind: "funding" }, { lead_id: "A", kind: "funding" },
        { lead_id: "A", kind: "intent" }, { lead_id: "B", kind: "funding" },
      ],
      observations: [{ lead_id: "C", watch_target: "#ai" }],
    };
    expect(rowOf(i, "funding").found).toBe(2);
    expect(rowOf(i, "intent").found).toBe(1);
    expect(rowOf(i, "intent:hashtags").found).toBe(1);
    expect(rowOf(i, "none").found).toBe(0);
  });
  const COLS = ["found", "contacted", "accepted", "replied", "interested", "closed"] as const;
  const stageSize = (i: ProofInput) => {
    const s = leadSets(i);
    return { found: i.leads.length, contacted: s.contacted.size, accepted: s.accepted.size,
      replied: s.replied.size, interested: s.interested.size, closed: s.closed.size };
  };
  const mk = (n: number, rnd: () => number) => {
    const ids = Array.from({ length: n }, (_, k) => `L${k}`);
    return ids.map((id) => lead(id, {
      status: rnd() < 0.2 ? "converted" : "sourced",
      linkedin_invited_at: rnd() < 0.5 ? "x" : null,
      linkedin_connected_at: rnd() < 0.3 ? "x" : null,
    }));
  };
  const rng = () => { let seed = 7; return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); };
  /** Overlapping fixture: leads can carry several signals and observations at once. */
  const overlapping = (): ProofInput => {
    const rnd = rng();
    const leads = mk(20, rnd);
    const kinds = ["funding", "hiring", "follow"];
    const targets = ["revenue ops", "acme", "#AI", "gone", null];
    const ids = leads.map((l) => l.id);
    return {
      ...empty(), watch, leads,
      sendLeadIds: ids.filter(() => rnd() < 0.3),
      replies: ids.filter(() => rnd() < 0.3).map((lead_id) => ({ lead_id, classification: rnd() < 0.5 ? "interested" : "neutral" })),
      signals: ids.filter(() => rnd() < 0.5).map((lead_id) => ({ lead_id, kind: kinds[Math.floor(rnd() * 3)]! })),
      observations: ids.filter(() => rnd() < 0.4).map((lead_id) => ({ lead_id, watch_target: targets[Math.floor(rnd() * 5)]! })),
    };
  };
  it("source columns are bounded by the funnel (max <= N <= sum) on overlapping data", () => {
    const i = overlapping();
    const m = buildProof(i);
    const N = stageSize(i);
    for (const c of COLS) {
      const vals = m.sources.map((r) => r[c] as number);
      expect(Math.max(...vals)).toBeLessThanOrEqual(N[c]);
      expect(vals.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(N[c]);
    }
    expect(m.sources.map((r) => r.key)).toEqual(expect.arrayContaining(["intent:removed", "none"]));
  });
  it("source columns sum exactly to the funnel when rows do not overlap", () => {
    const rnd = rng();
    const leads = mk(24, rnd);
    const targets = ["revenue ops", "acme", "gone", "#ai"];
    const i: ProofInput = {
      ...empty(), watch, leads,
      sendLeadIds: leads.filter(() => rnd() < 0.3).map((l) => l.id),
      replies: leads.filter(() => rnd() < 0.3).map((l) => ({ lead_id: l.id, classification: rnd() < 0.5 ? "interested" : "neutral" })),
      signals: leads.filter((_, k) => k % 3 === 0).map((l) => ({ lead_id: l.id, kind: "funding" })),
      observations: leads.filter((_, k) => k % 3 === 1).map((l, k) => ({ lead_id: l.id, watch_target: targets[k % 4]! })),
    };
    const m = buildProof(i);
    const N = stageSize(i);
    for (const c of COLS) {
      expect(m.sources.reduce((a, r) => a + (r[c] as number), 0)).toBe(N[c]);
    }
    expect(m.sources.find((r) => r.key === "intent:removed")!.found).toBeGreaterThan(0);
    expect(m.sources.find((r) => r.key === "none")!.found).toBeGreaterThan(0);
  });
  it("follow signal row is labelled Follows", () => {
    const i: ProofInput = { ...empty(), leads: [lead("A")], signals: [{ lead_id: "A", kind: "follow" }] };
    const r = sourceRows(i, leadSets(i)).find((x) => x.key === "follow")!;
    expect(r.label).toBe("Follows");
    expect(r.found).toBe(1);
  });
  it("null-target observation is not a watch row: lead falls to none or its signal row", () => {
    const i: ProofInput = {
      ...empty(), watch, leads: [lead("A"), lead("B")],
      signals: [{ lead_id: "B", kind: "hiring" }],
      observations: [{ lead_id: "A", watch_target: null }, { lead_id: "B", watch_target: null }],
    };
    const rows = sourceRows(i, leadSets(i));
    const get = (k: string) => rows.find((r) => r.key === k)!;
    expect(get("intent:removed").found).toBe(0);
    expect(get("none").found).toBe(1);
    expect(get("hiring").found).toBe(1);
  });
  it("creator match is slug-exact, not substring", () => {
    expect(watchCategory("https://linkedin.com/in/jane", watch)).toBe("removed");
    expect(watchCategory("https://linkedin.com/in/jane-doe", watch)).toBe("creators");
  });
  it("a watch target no longer configured lands in Removed watch targets", () => {
    const i: ProofInput = { ...empty(), watch, leads: [lead("A")], observations: [{ lead_id: "A", watch_target: "old" }] };
    expect(rowOf(i, "intent:removed").found).toBe(1);
    expect(rowOf(i, "intent:removed").group).toBe("intent");
  });
  it("unlisted target: removed with a present watch, unattributed with watch null", () => {
    const obs = { leads: [lead("A")], observations: [{ lead_id: "A", watch_target: "old" }] };
    expect(rowOf({ ...empty(), ...obs, watch }, "intent:removed").found).toBe(1);
    const m = buildProof({ ...empty(), ...obs, watch: null });
    for (const r of m.sources.filter((x) => x.group === "intent")) expect(r.found).toBe(0);
    expect(m.sources.find((r) => r.key === "none")!.found).toBe(1);
    expect(watchCategory("old", null)).toBeNull();
  });
  it("watchCategory normalises", () => {
    expect(watchCategory(" REVENUE ops ", watch)).toBe("keywords");
    expect(watchCategory("ai", watch)).toBe("hashtags");
    expect(watchCategory("#AI", watch)).toBe("hashtags");
    expect(watchCategory("linkedin.com/in/jane-doe/", watch)).toBe("creators");
    expect(watchCategory("nope", watch)).toBe("removed");
    expect(watchCategory(null, watch)).toBeNull();
  });
  it("agent rows map sources; Outreach found is null", () => {
    const i: ProofInput = {
      ...empty(),
      leads: [
        lead("A", { source: "discovery" }), lead("B", { source: "intent", linkedin_invited_at: "x" }),
        lead("C", { source: "manual" }), lead("D", { source: "ad" }),
      ],
    };
    const a = agentRows(i, leadSets(i));
    expect(a.map((r) => [r.key, r.found])).toEqual([
      ["agent:scout", 1], ["agent:intent", 1], ["agent:added", 2], ["agent:outreach", null],
    ]);
    expect(a.map((r) => r.label)).toEqual(["Prospect agent", "Intent agent", "Added by you", "Outreach agent"]);
    expect(a[3]!.contacted).toBe(buildProof(i).funnel[2]!.count);
    expect(sourceRows(i, leadSets(i)).at(-1)!.key).toBe("none");
  });
  it("per lead and column: in at least one source row iff in the stage set (overlapping data)", () => {
    const i = overlapping();
    const sets = leadSets(i);
    const inStage = (c: (typeof COLS)[number], id: string) => (c === "found" ? true : sets[c].has(id));
    expect(i.signals.length + i.observations.length).toBeGreaterThan(i.leads.length / 2);
    for (const l of i.leads) {
      // A one-lead input makes each row's count that lead's membership (0 or 1).
      const solo: ProofInput = { ...i, leads: [l] };
      const rows = sourceRows(solo, leadSets(solo));
      for (const c of COLS) {
        const inSomeRow = rows.some((r) => (r[c] as number) > 0);
        expect([l.id, c, inSomeRow]).toEqual([l.id, c, inStage(c, l.id)]);
      }
    }
  });
  it("Prospect + Intent + Added agent rows sum to the funnel for every column", () => {
    // Every leads.source value in packages/db/src/schema.ts: a new one must land in a row.
    const SOURCES = ["discovery", "manual", "import", "inbound", "ad", "intent"];
    const base = overlapping();
    const i: ProofInput = { ...base, leads: base.leads.map((l, k) => ({ ...l, source: SOURCES[k % SOURCES.length]! })) };
    const m = buildProof(i);
    const N = stageSize(i);
    const own = m.agents.filter((r) => r.key !== "agent:outreach");
    expect(own.map((r) => r.key)).toEqual(["agent:scout", "agent:intent", "agent:added"]);
    expect(own.reduce((a, r) => a + (r.found ?? 0), 0)).toBe(m.funnel[0]!.count);
    for (const c of ["contacted", "replied", "closed"] as const) {
      expect(own.reduce((a, r) => a + r[c], 0)).toBe(N[c]);
    }
  });
});
