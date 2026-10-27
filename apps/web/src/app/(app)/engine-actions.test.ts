import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Recording Supabase fake ──────────────────────────────────────────────────
// Every query is recorded as { table, op, values, filters }; `respond` decides what it resolves
// to. Covers the builder surface engine-actions uses (select/update + eq/in/limit/returns/
// maybeSingle), awaited directly or via maybeSingle().

type Op = "select" | "update";
type Call = { table: string; op: Op; values?: Record<string, unknown>; filters: Array<[string, string, unknown]> };
type Result = { data?: unknown; error?: unknown };

const calls: Call[] = [];
const revalidated: Array<[string, string | undefined]> = [];
let user: { id: string } | null = { id: "user-1" };
let respond: (c: Call) => Result = () => ({ data: null, error: null });

function makeClient() {
  return {
    auth: { getUser: async () => ({ data: { user } }) },
    from(table: string) {
      const call: Call = { table, op: "select", filters: [] };
      let opSet = false;
      const settle = () => {
        if (!calls.includes(call)) calls.push(call);
        return Promise.resolve({ data: null, error: null, ...respond(call) });
      };
      const filter = (kind: string) => (col: string, val: unknown) => {
        call.filters.push([kind, col, val]);
        return builder;
      };
      const builder: Record<string, unknown> = {
        select: () => {
          if (!opSet) opSet = true;
          return builder;
        },
        update: (v: Record<string, unknown>) => {
          call.op = "update";
          call.values = v;
          opSet = true;
          return builder;
        },
        eq: filter("eq"),
        in: filter("in"),
        limit: () => builder,
        returns: () => builder,
        maybeSingle: () => settle(),
        then: (ok: (v: Result) => unknown, bad?: (e: unknown) => unknown) => settle().then(ok, bad),
      };
      return builder;
    },
  };
}

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => makeClient() }));
vi.mock("next/cache", () => ({ revalidatePath: (p: string, t?: string) => revalidated.push([p, t]) }));

const { pauseEngine, resumeEngine, setAgentGroup } = await import("./engine-actions");

const ACCOUNT = { id: "acct-1" };
const updates = (table: string) => calls.filter((c) => c.table === table && c.op === "update");

/** An admin workspace: the account row is readable and writable; agents per `agents`. */
function admin(agents: Array<{ id: string; kind: string; status: string }>) {
  respond = (c) => {
    if (c.table === "accounts" && c.op === "select") return { data: ACCOUNT };
    if (c.table === "accounts" && c.op === "update") return { data: [ACCOUNT] };
    if (c.table === "agents" && c.op === "select") {
      const kinds = c.filters.find(([k, col]) => k === "in" && col === "kind")?.[2] as string[] | undefined;
      return { data: agents.filter((a) => !kinds || kinds.includes(a.kind)) };
    }
    if (c.table === "agents" && c.op === "update") {
      const statusEq = c.filters.find(([k, col]) => k === "eq" && col === "status")?.[2];
      const ids = c.filters.find(([k, col]) => k === "in" && col === "id")?.[2] as string[] | undefined;
      return { data: agents.filter((a) => (statusEq ? a.status === statusEq : true) && (!ids || ids.includes(a.id))).map((a) => ({ id: a.id })) };
    }
    return { data: null };
  };
}

beforeEach(() => {
  calls.length = 0;
  revalidated.length = 0;
  user = { id: "user-1" };
});

describe("pauseEngine", () => {
  it("sets paused_at, outreach_paused, and pauses every live agent", async () => {
    admin([
      { id: "a1", kind: "scout", status: "live" },
      { id: "a2", kind: "copy", status: "live" },
    ]);
    expect(await pauseEngine()).toEqual({});

    const [acct] = updates("accounts");
    expect(acct?.values?.outreach_paused).toBe(true);
    expect(typeof acct?.values?.paused_at).toBe("string");
    expect(acct?.filters).toContainEqual(["eq", "id", "acct-1"]);

    const [agents] = updates("agents");
    expect(agents?.values).toEqual({ status: "paused" });
    expect(agents?.filters).toContainEqual(["eq", "status", "live"]);

    expect(revalidated).toContainEqual(["/", "layout"]);
    expect(revalidated).toContainEqual(["/today", undefined]);
  });

  it("a workspace with no agents pauses without error", async () => {
    admin([]);
    expect(await pauseEngine()).toEqual({});
    expect(updates("accounts")).toHaveLength(1);
  });

  it("a non-admin (RLS returns 0 rows) gets an error and no agent is touched", async () => {
    admin([{ id: "a1", kind: "scout", status: "live" }]);
    const base = respond;
    respond = (c) => (c.table === "accounts" && c.op === "update" ? { data: [] } : base(c));
    const res = await pauseEngine();
    expect(res.error).toMatch(/admins/);
    expect(updates("agents")).toHaveLength(0);
    expect(revalidated).toHaveLength(0);
  });

  it("no session → error, no writes", async () => {
    user = null;
    admin([]);
    expect((await pauseEngine()).error).toBeTruthy();
    expect(calls.filter((c) => c.op === "update")).toHaveLength(0);
  });
});

describe("resumeEngine", () => {
  it("clears paused_at, clears outreach_paused, and sets paused agents back to live", async () => {
    admin([{ id: "a1", kind: "scout", status: "paused" }]);
    expect(await resumeEngine()).toEqual({});

    const [acct] = updates("accounts");
    expect(acct?.values).toEqual({ paused_at: null, outreach_paused: false });

    const [agents] = updates("agents");
    expect(agents?.values).toEqual({ status: "live" });
    expect(agents?.filters).toContainEqual(["eq", "status", "paused"]);
    expect(revalidated).toContainEqual(["/", "layout"]);
  });

  it("non-admin → error", async () => {
    admin([]);
    const base = respond;
    respond = (c) => (c.table === "accounts" && c.op === "update" ? { data: [] } : base(c));
    expect((await resumeEngine()).error).toMatch(/admins/);
  });
});

describe("setAgentGroup", () => {
  it("sourcing = scout + intent; only flips agents not already in the target status", async () => {
    admin([
      { id: "s", kind: "scout", status: "live" },
      { id: "i", kind: "intent", status: "live" },
      { id: "c", kind: "copy", status: "live" },
      { id: "d", kind: "intent", status: "draft" },
    ]);
    expect(await setAgentGroup("sourcing", "paused")).toEqual({});

    const read = calls.find((c) => c.table === "agents" && c.op === "select");
    expect(read?.filters).toContainEqual(["in", "kind", ["scout", "intent"]]);
    const [write] = updates("agents");
    expect(write?.values).toEqual({ status: "paused" });
    expect(write?.filters).toContainEqual(["in", "id", ["s", "i"]]);

    expect(revalidated).toEqual(expect.arrayContaining([["/", "layout"], ["/playbook", undefined], ["/today", undefined]]));
  });

  it("outreach = copy", async () => {
    admin([{ id: "c", kind: "copy", status: "paused" }]);
    expect(await setAgentGroup("outreach", "live")).toEqual({});
    const read = calls.find((c) => c.table === "agents" && c.op === "select");
    expect(read?.filters).toContainEqual(["in", "kind", ["copy"]]);
    expect(updates("agents")[0]?.filters).toContainEqual(["in", "id", ["c"]]);
  });

  it("nothing to change (no agents, or already there) → no write, no error", async () => {
    admin([]);
    expect(await setAgentGroup("outreach", "live")).toEqual({});
    admin([{ id: "c", kind: "copy", status: "live" }]);
    expect(await setAgentGroup("outreach", "live")).toEqual({});
    expect(updates("agents")).toHaveLength(0);
  });

  it("a non-admin whose update matches 0 rows gets an error", async () => {
    admin([{ id: "s", kind: "scout", status: "live" }]);
    const base = respond;
    respond = (c) => (c.table === "agents" && c.op === "update" ? { data: [] } : base(c));
    expect((await setAgentGroup("sourcing", "paused")).error).toMatch(/admins/);
  });

  it("rejects an invalid group or status", async () => {
    admin([]);
    // @ts-expect-error — runtime guard against a forged client payload
    expect((await setAgentGroup("billing", "live")).error).toBeTruthy();
    // @ts-expect-error — runtime guard against a forged client payload
    expect((await setAgentGroup("sourcing", "draft")).error).toBeTruthy();
  });
});
