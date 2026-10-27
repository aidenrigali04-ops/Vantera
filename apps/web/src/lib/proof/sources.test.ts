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
  it("every source column reconciles to the funnel (union of row lead sets == stage set)", () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const kinds = ["funding", "hiring", "follow"];
    const targets = ["revenue ops", "acme", "#AI", "gone", null];
    const ids = Array.from({ length: 20 }, (_, n) => `L${n}`);
    const i: ProofInput = {
      ...empty(), watch,
      leads: ids.map((id) => lead(id, {
        status: rnd() < 0.2 ? "converted" : "sourced",
        linkedin_invited_at: rnd() < 0.5 ? "x" : null,
        linkedin_connected_at: rnd() < 0.3 ? "x" : null,
      })),
      sendLeadIds: ids.filter(() => rnd() < 0.3),
      replies: ids.filter(() => rnd() < 0.3).map((lead_id) => ({
        lead_id, classification: rnd() < 0.5 ? "interested" : "neutral",
      })),
      signals: ids.filter(() => rnd() < 0.5).map((lead_id) => ({ lead_id, kind: kinds[Math.floor(rnd() * 3)]! })),
      observations: ids.filter(() => rnd() < 0.4).map((lead_id) => ({
        lead_id, watch_target: targets[Math.floor(rnd() * 5)]!,
      })),
    };
    const m = buildProof(i);
    const stage = (k: string) => m.funnel.find((s) => s.key === k)!.count;
    // Every lead belongs to >=1 row; per-lead membership is recomputed independently below.
    const sets = leadSets(i);
    const member = new Map<string, Set<string>>();
    const add = (k: string, id: string) => (member.get(k) ?? member.set(k, new Set()).get(k)!).add(id);
    const sigIds = new Set(i.signals.map((s) => s.lead_id));
    const obsIds = new Set(i.observations.map((o) => o.lead_id));
    i.signals.forEach((s) => add(s.kind, s.lead_id));
    i.observations.forEach((o) => add(`intent:${watchCategory(o.watch_target, watch) ?? "removed"}`, o.lead_id));
    i.leads.forEach((l) => { if (!sigIds.has(l.id) && !obsIds.has(l.id)) add("none", l.id); });
    const union = new Set([...member.values()].flatMap((s) => [...s]));
    expect(union.size).toBe(stage("found"));
    for (const [col, set] of [["contacted", sets.contacted], ["replied", sets.replied], ["interested", sets.interested], ["closed", sets.closed]] as const) {
      const u = new Set<string>();
      for (const [, s] of member) for (const id of s) if (set.has(id)) u.add(id);
      expect(u.size).toBe(stage(col));
      expect(u.size).toBe(set.size);
    }
    expect(m.sources.map((r) => r.key)).toEqual(expect.arrayContaining(["intent:removed", "none"]));
  });
  it("a watch target no longer configured lands in Removed watch targets", () => {
    const i: ProofInput = { ...empty(), watch, leads: [lead("A")], observations: [{ lead_id: "A", watch_target: "old" }] };
    expect(rowOf(i, "intent:removed").found).toBe(1);
    expect(rowOf(i, "intent:removed").group).toBe("intent");
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
    expect(a[3]!.contacted).toBe(buildProof(i).funnel[2]!.count);
    expect(sourceRows(i, leadSets(i)).at(-1)!.key).toBe("none");
  });
});
