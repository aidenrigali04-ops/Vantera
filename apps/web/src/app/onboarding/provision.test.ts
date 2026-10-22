import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("server-only", () => ({}));

import { provisionOnboardingAgents, DEFAULT_CTA } from "./provision";

type Row = Record<string, unknown>;

/** Minimal in-memory supabase: select/eq/limit/maybeSingle and insert/select/single. */
function fakeSupabase() {
  const tables: Record<string, Row[]> = { agents: [], agent_icps: [], campaigns: [] };
  let n = 0;
  const from = (table: string) => {
    const rows = tables[table];
    const filters: Array<[string, unknown]> = [];
    let inserted: Row | null = null;
    const b = {
      select: () => b,
      eq: (col: string, val: unknown) => (filters.push([col, val]), b),
      limit: () => b,
      insert: (row: Row) => {
        inserted = { ...(table === "agent_icps" ? {} : { id: `${table}-${++n}` }), ...row };
        rows.push(inserted);
        return b;
      },
      maybeSingle: async () => ({
        data: rows.find((r) => filters.every(([c, v]) => r[c] === v)) ?? null,
        error: null,
      }),
      single: async () => ({ data: inserted, error: null }),
      then: (res: (v: { data: null; error: null }) => unknown) => res({ data: null, error: null }),
    };
    return b;
  };
  return { client: { from } as unknown as SupabaseClient, tables };
}

const deps = (supabase: SupabaseClient) => ({
  supabase,
  accountId: "acc-1",
  userId: "user-1",
  icp: { id: "icp-1", name: "Founders" },
});

describe("provisionOnboardingAgents", () => {
  it("creates scout, campaign and copy agent once", async () => {
    const { client, tables } = fakeSupabase();
    const r = await provisionOnboardingAgents(deps(client));
    expect(tables.agents).toHaveLength(2);
    expect(tables.campaigns).toHaveLength(1);
    expect(tables.agent_icps).toEqual([
      { agent_id: r.scoutId, icp_id: "icp-1", account_id: "acc-1", position: 0 },
    ]);
    const scout = tables.agents.find((a) => a.kind === "scout")!;
    expect(scout).toMatchObject({
      config: { prospects_per_run: 60, min_score: 70 },
      run_at_time: "08:00",
      cadence: "daily",
      timezone: "UTC",
      status: "live",
    });
    expect(scout.next_run_at).toBeUndefined();
  });

  it("second call reuses all three", async () => {
    const { client, tables } = fakeSupabase();
    const a = await provisionOnboardingAgents(deps(client));
    const b = await provisionOnboardingAgents(deps(client));
    expect(b).toEqual(a);
    expect(tables.agents).toHaveLength(2);
    expect(tables.campaigns).toHaveLength(1);
    expect(tables.agent_icps).toHaveLength(1);
  });

  it("copy agent carries campaign_id", async () => {
    const { client, tables } = fakeSupabase();
    const r = await provisionOnboardingAgents(deps(client));
    const copy = tables.agents.find((a) => a.kind === "copy")!;
    expect(copy.id).toBe(r.copyAgentId);
    expect(copy.campaign_id).toBe(r.campaignId);
    expect(copy.config).toEqual({ cta: DEFAULT_CTA, channels: { linkedin: true } });
    expect(tables.campaigns[0]).toMatchObject({
      channels: ["linkedin"],
      copywriting_mode: "agent",
      send_mode: "review",
      name: "Outreach (agent)",
    });
  });
});
