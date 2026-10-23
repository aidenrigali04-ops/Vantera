import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveScoutIcp, saveScoutIcp } from "./resolve-icp";

type Call = { table: string; op: string; filters: Record<string, unknown>; payload?: unknown };

/** Recording fake: every chain is thenable/maybeSingle and answers from `tables`. */
function fake(tables: Record<string, Record<string, unknown> | null>) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const call: Call = { table, op: "select", filters: {} };
      const result = () => {
        calls.push(call);
        return { data: tables[table] ?? null, error: null };
      };
      const chain: Record<string, unknown> = {
        select: () => chain,
        update: (p: unknown) => ((call.op = "update"), (call.payload = p), chain),
        insert: (p: unknown) => ((call.op = "insert"), (call.payload = p), chain),
        eq: (k: string, v: unknown) => ((call.filters[k] = v), chain),
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => result(),
        then: (res: (v: unknown) => unknown) => res(result()),
      };
      return chain;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

const icp = { id: "i1", name: "Buyers", criteria: null };

describe("resolveScoutIcp / saveScoutIcp", () => {
  it("prefers the Scout's position-0 linked ICP, pinned to the account", async () => {
    const { client, calls } = fake({ agent_icps: { icp_id: "i1" }, icps: icp });
    expect(await resolveScoutIcp(client, "a1", "g1")).toEqual(icp);
    expect(calls.every((c) => c.filters.account_id === "a1")).toBe(true);
    expect(calls[0]).toMatchObject({ table: "agent_icps", filters: { agent_id: "g1" } });
    expect(calls[1].filters).toMatchObject({ id: "i1" });
  });

  it("falls back to the onboarding row when there is no link", async () => {
    const { client, calls } = fake({ agent_icps: null, icps: icp });
    expect(await resolveScoutIcp(client, "a1", "g1")).toEqual(icp);
    expect(calls[1].filters).toMatchObject({ source: "onboarding", account_id: "a1" });
  });

  it("updates the resolved row in place", async () => {
    const { client, calls } = fake({ agent_icps: { icp_id: "i1" }, icps: icp });
    expect(await saveScoutIcp(client, { accountId: "a1", agentId: "g1", name: "N", criteria: {} })).toEqual({ error: false });
    const upd = calls.find((c) => c.op === "update")!;
    expect(upd.filters).toMatchObject({ id: "i1", account_id: "a1" });
  });

  it("inserts an onboarding ICP and links it to the Scout at position 0 when none exists", async () => {
    const tables: Record<string, Record<string, unknown> | null> = { agent_icps: null, icps: null };
    const { client, calls } = fake(tables);
    // after the first (empty) resolve reads, make the insert return an id
    const orig = client.from.bind(client);
    (client as unknown as { from: unknown }).from = (t: string) => {
      const ch = orig(t) as unknown as Record<string, unknown>;
      const ins = ch.insert as (p: unknown) => unknown;
      if (t === "icps") ch.insert = (p: unknown) => (tables.icps = { id: "new1" }, ins(p));
      return ch;
    };
    const res = await saveScoutIcp(client, { accountId: "a1", agentId: "g1", name: "N", criteria: {} });
    expect(res).toEqual({ error: false });
    expect(calls.find((c) => c.table === "icps" && c.op === "insert")!.payload).toMatchObject({ source: "onboarding", name: "N", account_id: "a1" });
    expect(calls.find((c) => c.table === "agent_icps" && c.op === "insert")!.payload).toEqual({ agent_id: "g1", icp_id: "new1", account_id: "a1", position: 0 });
  });
});
