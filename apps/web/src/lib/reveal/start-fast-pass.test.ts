import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const trigger = vi.fn();
let accountRow: unknown = { id: "acc1", onboarding_completed_at: null };
let deleteError: unknown = null;
vi.mock("@trigger.dev/sdk", () => ({ tasks: { trigger: (...a: unknown[]) => trigger(...a) } }));

// RLS client: account + onboarding icp present. Any other table read (e.g. linkedin_accounts)
// would throw, proving the LinkedIn precondition is gone.
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from(table: string) {
      const rows: Record<string, unknown> = {
        accounts: accountRow,
        icps: { id: "icp1" },
      };
      if (!(table in rows)) throw new Error(`unexpected RLS read of ${table}`);
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "limit"]) b[m] = () => b;
      b.is = () => b;
      b.maybeSingle = async () => ({ data: rows[table], error: null });
      return b;
    },
  }),
}));

let existingRun: { id: string; status: string } | null = null;
const inserts: unknown[] = [];
const deletes: Array<Record<string, string>> = [];
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from(table: string) {
      if (table !== "reveal_runs") throw new Error(`unexpected service table ${table}`);
      const b: Record<string, unknown> = {};
      let op = "select";
      const filters: Record<string, string> = {};
      b.select = () => b;
      b.insert = (v: unknown) => {
        op = "insert";
        inserts.push(v);
        return b;
      };
      b.update = () => {
        op = "update";
        return b;
      };
      b.delete = () => {
        op = "delete";
        return b;
      };
      b.eq = (k: string, v: string) => {
        filters[k] = v;
        if (op === "delete") {
          deletes.push({ ...filters });
          existingRun = null;
          return Promise.resolve({ error: deleteError });
        }
        return b;
      };
      b.maybeSingle = async () => ({ data: existingRun, error: null });
      b.single = async () => ({ data: { id: "run_new" }, error: null });
      return b;
    },
  }),
}));

import { maybeStartFastPass, resetRevealRun } from "./start-fast-pass";

beforeEach(() => {
  trigger.mockReset();
  existingRun = null;
  accountRow = { id: "acc1", onboarding_completed_at: null };
  deleteError = null;
  inserts.length = 0;
  deletes.length = 0;
});

describe("maybeStartFastPass", () => {
  it("starts without any linkedin_accounts row", async () => {
    const out = await maybeStartFastPass("acc1");
    expect(out).toEqual({ started: true });
    expect(inserts).toHaveLength(1);
    expect(trigger).toHaveBeenCalledWith(
      "fast-pass",
      { accountId: "acc1", revealRunId: "run_new" },
      { concurrencyKey: "acc1" }
    );
  });

  it("does not start twice for a non-failed run", async () => {
    existingRun = { id: "run1", status: "scanning" };
    const out = await maybeStartFastPass("acc1");
    expect(out).toEqual({ started: false });
    expect(trigger).not.toHaveBeenCalled();
    expect(inserts).toHaveLength(0);
  });

  it("resetRevealRun deletes the row so the next start inserts fresh", async () => {
    existingRun = { id: "run1", status: "done" };
    await resetRevealRun("acc1");
    expect(deletes).toEqual([{ account_id: "acc1" }]);
    const out = await maybeStartFastPass("acc1");
    expect(out).toEqual({ started: true });
    expect(inserts).toHaveLength(1);
  });

  it("resetRevealRun does nothing for an account the session cannot see", async () => {
    accountRow = null;
    existingRun = { id: "run1", status: "done" };
    await resetRevealRun("other_acc");
    expect(deletes).toHaveLength(0);
    expect(existingRun).not.toBeNull();
  });

  it("resetRevealRun throws when the delete fails", async () => {
    deleteError = { message: "boom" };
    await expect(resetRevealRun("acc1")).rejects.toThrow("reveal reset failed");
  });
});
