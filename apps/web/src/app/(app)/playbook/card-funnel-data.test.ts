import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadCardFunnels } from "./card-funnel-data";

type Result = { data: unknown; error: unknown };

/** Chainable fake: every query on a table resolves to the canned result. */
function fakeDb(results: Record<string, Result>) {
  return {
    from(table: string) {
      const builder: Record<string, unknown> = {
        then: (ok: (r: Result) => unknown, bad?: (e: unknown) => unknown) =>
          Promise.resolve(results[table] ?? { data: [], error: null }).then(ok, bad),
      };
      for (const op of ["select", "not", "eq", "order", "range", "limit", "maybeSingle"]) {
        builder[op] = () => builder;
      }
      return builder;
    },
  } as unknown as SupabaseClient;
}

afterEach(() => vi.restoreAllMocks());

describe("loadCardFunnels", () => {
  it("returns null funnels when the proof read throws, and logs it", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = await loadCardFunnels(fakeDb({ leads: { data: null, error: { message: "down" } } }));
    expect(out).toBeNull();
    expect(err).toHaveBeenCalledWith("playbook: card funnels failed", expect.any(Error));
  });

  it("a completed run with a null summary counts as a run", async () => {
    const out = await loadCardFunnels(fakeDb({ agent_runs: { data: { summary: null }, error: null }, agents: { data: null, error: null } }));
    expect(out?.intentRan).toBe(true);
  });

  it("no completed run reads as not run", async () => {
    const out = await loadCardFunnels(fakeDb({ agent_runs: { data: null, error: null }, agents: { data: null, error: null } }));
    expect(out?.intentRan).toBe(false);
  });
});
