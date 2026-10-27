import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@vantera/agent-brains", () => ({
  pickWhyNow: (signals: unknown[]) => (signals.length ? { kind: "funding", text: "raised" } : null),
}));

const { buildFirstTouchDraftInput } = await import("./first-touch-input");

type Rows = Record<string, unknown>;
function fakeClient(rows: Rows) {
  return {
    from(table: string) {
      const result = { data: rows[table] ?? null, error: null };
      const b: Record<string, unknown> = {
        select: () => b,
        eq: () => b,
        in: () => b,
        limit: () => b,
        maybeSingle: () => Promise.resolve(result),
        returns: () => b,
        then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(result).then(ok, bad),
      };
      return b;
    },
  } as never;
}

const base: Rows = {
  leads: { id: "l1", first_name: "Sam", last_name: "Lee", title: "VP", company_name: "Acme", industry: "SaaS", ai_insights: { summary: "x" } },
  agents: { config: { cta: "book intro", bookingUrl: "https://cal.example/x", websiteUrl: "https://site.example" } },
  accounts: { name: "Seller", onboarding_industry: "Ops", value_prop: null, brand_voice: "warm", guardrails: "no pricing", website_scan: { summary: "scan summary" } },
  proof_points: [{ kind: "proof", text: "t", question: null }],
  lead_signals: [{ kind: "funding", label: "Raised", detail: null, observed_at: "2026-10-01T00:00:00Z" }],
};

describe("buildFirstTouchDraftInput", () => {
  it("omits bookingUrl, falls back to the scan summary, and attaches why-now", async () => {
    const input = await buildFirstTouchDraftInput(fakeClient(base), "l1");
    expect(input).not.toBeNull();
    expect(input!.context.bookingUrl).toBeUndefined();
    // the pipeline's toDraftInput sets neither: no link and no seller name in first-touch grounding
    expect(input!.context).not.toHaveProperty("websiteUrl");
    expect(input!.context).not.toHaveProperty("accountName");
    expect(input!.context.cta).toBe("book intro");
    expect(input!.context.valueProp).toBe("scan summary");
    expect(input!.context.brandVoice).toBe("warm");
    expect(input!.context.proofPoints).toBeUndefined();
    expect(input!.lead.whyNow).toEqual({ kind: "funding", text: "raised" });
  });

  it("prefers the seller-authored value prop", async () => {
    const accounts = { ...(base.accounts as object), value_prop: "we fix churn" };
    const input = await buildFirstTouchDraftInput(fakeClient({ ...base, accounts }), "l1");
    expect(input!.context.valueProp).toBe("we fix churn");
  });

  it("reads the Outreach agent whether live or paused (Regenerate still works while paused)", async () => {
    const filters: unknown[][] = [];
    const client = fakeClient(base) as unknown as { from: (t: string) => Record<string, (...a: unknown[]) => unknown> };
    const spy = {
      from(table: string) {
        const b = client.from(table);
        const wrapped: Record<string, unknown> = { ...b };
        for (const k of ["eq", "in"]) wrapped[k] = (...a: unknown[]) => (table === "agents" && filters.push([k, ...a]), wrapped);
        for (const k of ["select", "limit", "returns"]) wrapped[k] = () => wrapped;
        return wrapped;
      },
    };
    expect(await buildFirstTouchDraftInput(spy as never, "l1")).not.toBeNull();
    expect(filters).toContainEqual(["in", "status", ["live", "paused"]]);
    expect(filters).not.toContainEqual(["eq", "status", "live"]);
  });

  it("returns null without a deployed (live or paused) copy agent", async () => {
    expect(await buildFirstTouchDraftInput(fakeClient({ ...base, agents: null }), "l1")).toBeNull();
  });

  it("returns null when the lead is not visible or has no insights", async () => {
    expect(await buildFirstTouchDraftInput(fakeClient({ ...base, leads: null }), "l1")).toBeNull();
    expect(await buildFirstTouchDraftInput(fakeClient({ ...base, leads: { ...(base.leads as object), ai_insights: null } }), "l1")).toBeNull();
  });
});
