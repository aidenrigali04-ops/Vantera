import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { genomeSignature } from "@vantera/agent-brains";
import { stampEnteredLead, type StrategyStampDeps } from "./stamp";

const genome = { outreach_first_touch: { openWith: "trigger" } };

function deps(partial?: Partial<StrategyStampDeps>): StrategyStampDeps & { stamps: string[]; strategies: Map<string, string> } {
  const strategies = new Map<string, string>();
  const stamps: string[] = [];
  const base: StrategyStampDeps = {
    async upsertStrategy(_accountId, next, _source) {
      const signature = genomeSignature(next);
      const existing = strategies.get(signature);
      if (existing) return existing;
      const id = `strategy-${strategies.size + 1}`;
      strategies.set(signature, id);
      return id;
    },
    async hasStamp(_accountId, leadId) {
      return stamps.some((row) => row.startsWith(`${leadId}:`));
    },
    async stampLead(accountId, leadId, strategyId) {
      stamps.push(`${leadId}:${accountId}:${strategyId}`);
    },
  };
  return { ...base, ...partial, stamps, strategies };
}

describe("stampEnteredLead", () => {
  it("stamps a new lead exactly once with the account's active strategy", async () => {
    const store = deps();
    const first = await stampEnteredLead(store, {
      accountId: "acct",
      leadId: "lead-1",
      genome,
      source: "manual",
    });
    const again = await stampEnteredLead(store, {
      accountId: "acct",
      leadId: "lead-1",
      genome,
      source: "manual",
    });
    expect(first.signature).toBe(genomeSignature(genome));
    expect(again.strategyId).toBe(first.strategyId);
    expect(store.stamps).toHaveLength(1);
  });

  it("dedupes one strategy row per signature on the account", async () => {
    const store = deps();
    await stampEnteredLead(store, { accountId: "acct", leadId: "a", genome, source: "manual" });
    await stampEnteredLead(store, { accountId: "acct", leadId: "b", genome, source: "manual" });
    expect(store.strategies.size).toBe(1);
    expect(store.stamps).toHaveLength(2);
  });

  it("uses the default genome when the account has no strategy yet", async () => {
    const store = deps();
    const stamped = await stampEnteredLead(store, { accountId: "acct", leadId: "a" });
    expect(stamped.signature).toBe("default");
    expect(store.stamps[0]).toContain("strategy-1");
  });

  it("does not send, schedule, or consult suppression — it only records the stamp", () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "stamp.ts"), "utf8");
    expect(src).not.toMatch(/scheduled_sends|insertScheduledSend|isSuppressed|outreach-send|pending_review/);
  });
});
