import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadProof } from "./load";
import { PROOF_ROW_CAP } from "./types";

type Result = { data: unknown; error: unknown };
type Call = { table: string; ops: [string, unknown[]][] };

/** Chainable fake: records every builder call per table, resolves to the canned result. */
function fakeDb(results: Record<string, Result>) {
  const calls: Call[] = [];
  const db = {
    from(table: string) {
      const call: Call = { table, ops: [] };
      calls.push(call);
      const res = results[table] ?? { data: [], error: null };
      const builder: Record<string, unknown> = {
        then: (ok: (r: Result) => unknown, bad?: (e: unknown) => unknown) =>
          Promise.resolve(res).then(ok, bad),
      };
      for (const op of ["select", "not", "eq", "limit", "maybeSingle"]) {
        builder[op] = (...args: unknown[]) => {
          call.ops.push([op, args]);
          return builder;
        };
      }
      return builder;
    },
  };
  return { db: db as unknown as SupabaseClient, calls };
}

const lead = (id: string) => ({
  id, status: "qualified", source: "scout",
  linkedin_invited_at: null, linkedin_connected_at: null, meeting_booked_at: null,
});
const ok = (data: unknown): Result => ({ data, error: null });

afterEach(() => vi.restoreAllMocks());

describe("loadProof", () => {
  it("issues the six RLS-scoped selects, each capped", async () => {
    const { db, calls } = fakeDb({ agents: ok(null) });
    await loadProof(db);
    const by = Object.fromEntries(calls.map((c) => [c.table, c.ops]));
    expect(Object.keys(by).sort()).toEqual(
      ["agents", "intent_observations", "lead_signals", "leads", "outreach_sends", "replies"]
    );
    expect(by.leads).toEqual([
      ["select", ["id,status,source,linkedin_invited_at,linkedin_connected_at,meeting_booked_at"]],
      ["limit", [PROOF_ROW_CAP]],
    ]);
    expect(by.outreach_sends).toEqual([
      ["select", ["lead_id"]], ["not", ["lead_id", "is", null]], ["limit", [PROOF_ROW_CAP]],
    ]);
    expect(by.replies).toEqual([["select", ["lead_id,classification"]], ["limit", [PROOF_ROW_CAP]]]);
    expect(by.lead_signals).toEqual([["select", ["lead_id,kind"]], ["limit", [PROOF_ROW_CAP]]]);
    expect(by.intent_observations).toEqual([
      ["select", ["lead_id,watch_target"]], ["not", ["lead_id", "is", null]], ["limit", [PROOF_ROW_CAP]],
    ]);
    expect(by.agents).toEqual([
      ["select", ["config"]], ["eq", ["kind", "intent"]], ["limit", [1]], ["maybeSingle", []],
    ]);
    for (const c of calls) expect(c.ops.some(([op, a]) => op === "eq" && a[0] !== "kind")).toBe(false);
  });

  it("flips capped at exactly PROOF_ROW_CAP rows, not one below", async () => {
    const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ lead_id: `l${i}`, kind: "hiring" }));
    const below = await loadProof(fakeDb({ lead_signals: ok(rows(PROOF_ROW_CAP - 1)) }).db);
    expect(below.capped).toBe(false);
    const at = await loadProof(fakeDb({ lead_signals: ok(rows(PROOF_ROW_CAP)) }).db);
    expect(at.capped).toBe(true);
  });

  it("a failed lead_signals read logs and degrades to 'No signal captured', never throws", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const model = await loadProof(fakeDb({
      leads: ok([lead("a"), lead("b")]),
      lead_signals: { data: null, error: { message: "provider exploded" } },
    }).db);
    expect(err).toHaveBeenCalledWith("proof: lead_signals read failed", { message: "provider exploded" });
    const none = model.sources.find((r) => r.key === "none");
    expect(none?.label).toBe("No signal captured");
    expect(none?.found).toBe(2);
    expect(model.funnel[0]!.count).toBe(2);
  });

  it("drops null send lead ids and parses a partial watch config defensively", async () => {
    const model = await loadProof(fakeDb({
      leads: ok([{ ...lead("a"), linkedin_invited_at: null }, lead("b")]),
      outreach_sends: ok([{ lead_id: "a" }, { lead_id: null }]),
      intent_observations: ok([{ lead_id: "b", watch_target: "acme" }]),
      agents: ok({ config: { watch: { competitors: ["Acme"], keywords: "nope" } } }),
    }).db);
    expect(model.funnel.find((s) => s.key === "contacted")!.count).toBe(1);
    expect(model.sources.find((r) => r.key === "intent:competitors")!.found).toBe(1);
  });
});
