import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runCampaignSendState } from "./mutate-tools";

function fakeDb(campaign: { id: string; status: string } | null) {
  const updates: { id: string; status: string }[] = [];
  const db = {
    updates,
    from(table: string) {
      if (table === "agents") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- recursive self-referential builder; no practical typed alternative
        const b: Record<string, any> = {
          select: () => b,
          eq: () => b,
          limit: () => b,
          maybeSingle: async () => ({
            data: campaign
              ? { name: "Penn", campaigns: campaign }
              : null,
          }),
        };
        return b;
      }
      if (table === "campaigns") {
        return {
          update: (vals: { status: string }) => ({
            eq: (_col: string, id: string) => {
              updates.push({ id, status: vals.status });
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      return {} as unknown as Record<string, unknown>;
    },
  };
  return db as unknown as SupabaseClient & { updates: typeof updates };
}

describe("runCampaignSendState", () => {
  it("pauses an active campaign and reports the reverse op for undo", async () => {
    const db = fakeDb({ id: "c1", status: "active" });
    const out = await runCampaignSendState(db, "pause");
    expect(db.updates).toEqual([{ id: "c1", status: "paused" }]);
    expect(out).toEqual({
      summary: expect.stringContaining("Paused"),
      undoable: true,
      undoTo: "resume",
      deepLink: "/agents",
    });
  });

  it("resumes a paused campaign", async () => {
    const db = fakeDb({ id: "c1", status: "paused" });
    const out = await runCampaignSendState(db, "resume");
    expect(db.updates).toEqual([{ id: "c1", status: "active" }]);
    expect(out.undoTo).toBe("pause");
  });

  it("is a safe no-op message when there is no campaign", async () => {
    const out = await runCampaignSendState(fakeDb(null), "pause");
    expect(out.undoable).toBe(false);
    expect(out.summary).toMatch(/no outreach campaign/i);
  });
});
