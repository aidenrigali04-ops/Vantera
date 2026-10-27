import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadProof } from "./load";
import { PROOF_PAGE_SIZE, PROOF_ROW_CAP } from "./types";

type Result = { data: unknown; error: unknown };
type Canned = Result | ((from: number, to: number) => Result);
type Call = { table: string; ops: [string, unknown[]][] };

/** Chainable fake: records builder calls per request; `.range(f,t)` feeds the canned fn. */
function fakeDb(results: Record<string, Canned>) {
  const calls: Call[] = [];
  const db = {
    from(table: string) {
      const call: Call = { table, ops: [] };
      calls.push(call);
      const resolve = (): Result => {
        const c = results[table] ?? { data: [], error: null };
        if (typeof c !== "function") return c;
        const r = call.ops.find(([op]) => op === "range");
        return c(...((r?.[1] ?? [0, 0]) as [number, number]));
      };
      const builder: Record<string, unknown> = {
        then: (ok: (r: Result) => unknown, bad?: (e: unknown) => unknown) =>
          Promise.resolve(resolve()).then(ok, bad),
      };
      for (const op of ["select", "not", "eq", "order", "range", "limit", "maybeSingle"]) {
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
  id, status: "qualified", source: "discovery",
  linkedin_invited_at: null, linkedin_connected_at: null, meeting_booked_at: null,
});
const ok = (data: unknown): Result => ({ data, error: null });
/** A table of n signal rows served page-by-page by range. */
const signalTable = (n: number) => (from: number, to: number) =>
  ok(Array.from({ length: Math.max(0, Math.min(n, to + 1) - from) }, (_, i) => ({ lead_id: `l${from + i}`, kind: "hiring" })));
const desc = { ascending: false };

afterEach(() => vi.restoreAllMocks());

describe("loadProof", () => {
  it("issues the RLS-scoped selects in a stable order, paged by range", async () => {
    const { db, calls } = fakeDb({ agents: ok(null) });
    await loadProof(db);
    const by = Object.fromEntries(calls.map((c) => [c.table, c.ops]));
    expect(Object.keys(by).sort()).toEqual(
      ["agents", "intent_observations", "lead_signals", "leads", "outreach_sends", "replies"]
    );
    const page = [["range", [0, PROOF_PAGE_SIZE - 1]]];
    const ord = (col: string) => [["order", [col, desc]], ["order", ["id", desc]]];
    expect(by.leads).toEqual([
      ["select", ["id,status,source,linkedin_invited_at,linkedin_connected_at,meeting_booked_at"]],
      ...ord("created_at"), ...page,
    ]);
    expect(by.outreach_sends).toEqual([
      ["select", ["lead_id"]], ["not", ["lead_id", "is", null]], ...ord("sent_at"), ...page,
    ]);
    expect(by.replies).toEqual([["select", ["lead_id,classification"]], ...ord("created_at"), ...page]);
    expect(by.lead_signals).toEqual([["select", ["lead_id,kind"]], ...ord("created_at"), ...page]);
    expect(by.intent_observations).toEqual([
      ["select", ["lead_id,watch_target"]], ["not", ["lead_id", "is", null]], ...ord("observed_at"), ...page,
    ]);
    expect(by.agents).toEqual([
      ["select", ["config"]], ["eq", ["kind", "intent"]], ["limit", [1]], ["maybeSingle", []],
    ]);
    for (const c of calls) expect(c.ops.some(([op, a]) => op === "eq" && a[0] !== "kind")).toBe(false);
  });

  it("2500 rows read in 3 pages and are not capped", async () => {
    const { db, calls } = fakeDb({ lead_signals: signalTable(2500) });
    const m = await loadProof(db);
    const pages = calls.filter((c) => c.table === "lead_signals").map((c) => c.ops.find(([o]) => o === "range")![1]);
    expect(pages).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
    expect(m.capped).toBe(false);
  });

  it("PROOF_ROW_CAP rows cap after exactly 5 requests", async () => {
    const { db, calls } = fakeDb({ lead_signals: signalTable(PROOF_ROW_CAP + 3000) });
    const m = await loadProof(db);
    expect(calls.filter((c) => c.table === "lead_signals")).toHaveLength(5);
    expect(m.capped).toBe(true);
    const exact = fakeDb({ lead_signals: signalTable(PROOF_ROW_CAP) });
    expect((await loadProof(exact.db)).capped).toBe(true);
    expect(exact.calls.filter((c) => c.table === "lead_signals")).toHaveLength(5);
  });

  it("a page-2 error logs and empties that table, never throws", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const full = signalTable(2500);
    const boom = { message: "provider exploded on page 2" };
    const m = await loadProof(fakeDb({
      leads: ok([lead("l0"), lead("l1")]),
      lead_signals: (f, t) => (f === PROOF_PAGE_SIZE ? { data: null, error: boom } : full(f, t)),
    }).db);
    expect(err).toHaveBeenCalledWith("proof: lead_signals read failed", boom);
    expect(m.sources.filter((r) => r.group === "signal")).toHaveLength(0);
    expect(m.sources.find((r) => r.key === "none")!.found).toBe(2);
    expect(JSON.stringify(m)).not.toContain("provider exploded");
  });

  it("a failed lead_signals read degrades to 'No signal captured' without leaking provider text", async () => {
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
    expect(JSON.stringify(model)).not.toContain("provider exploded");
  });

  it("drops null send lead ids and parses a partial watch config defensively", async () => {
    const model = await loadProof(fakeDb({
      leads: ok([lead("a"), lead("b")]),
      outreach_sends: ok([{ lead_id: "a" }, { lead_id: null }]),
      intent_observations: ok([{ lead_id: "b", watch_target: "acme" }]),
      agents: ok({ config: { watch: { competitors: ["Acme"], keywords: "nope" } } }),
    }).db);
    expect(model.funnel.find((s) => s.key === "contacted")!.count).toBe(1);
    expect(model.sources.find((r) => r.key === "intent:competitors")!.found).toBe(1);
  });
});
