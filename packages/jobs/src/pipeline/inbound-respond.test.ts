import { describe, expect, it, vi } from "vitest";
import { runInboundRespond } from "./inbound-respond";
import type { InboundRespondDeps, InboundLead } from "./inbound-respond";

// Phase 12 — the report's most defensible "what works": fast inbound response. Speed is the
// product, so the core qualifies + drafts a reply the moment a lead arrives, reusing the
// existing qualify + copy brains (injected). Suppression is checked at the boundary (rule 11).
const lead: InboundLead = {
  accountId: "acc1",
  source: "form_fill",
  email: "jordan@acme.com",
  firstName: "Jordan",
  companyName: "Acme",
};

function deps(over: Partial<InboundRespondDeps> = {}): InboundRespondDeps {
  return {
    sendMode: "review",
    isSuppressed: vi.fn(async () => false),
    qualify: vi.fn(async () => ({ passed: true, score: 82 })),
    draft: vi.fn(async () => ({ body: "Saw your note — worth a quick look?", violations: [] })),
    ...over,
  };
}

describe("runInboundRespond", () => {
  it("skips with no contact info", async () => {
    const res = await runInboundRespond({ ...lead, email: null }, deps());
    expect(res.action).toBe("skipped");
  });

  it("never responds to a suppressed contact (rule 11)", async () => {
    const d = deps({ isSuppressed: vi.fn(async () => true) });
    const res = await runInboundRespond(lead, d);
    expect(res.action).toBe("suppressed");
    expect(d.draft).not.toHaveBeenCalled();
  });

  it("rejects a lead that fails the quality gate (no spray)", async () => {
    const d = deps({ qualify: vi.fn(async () => ({ passed: false, score: 20 })) });
    const res = await runInboundRespond(lead, d);
    expect(res.action).toBe("rejected");
    expect(d.draft).not.toHaveBeenCalled();
  });

  it("drafts and routes to review when send mode is review", async () => {
    const res = await runInboundRespond(lead, deps({ sendMode: "review" }));
    expect(res.action).toBe("review");
    expect(res.draft?.body).toContain("worth a quick look");
  });

  it("auto-sends a clean draft within SLA when send mode is auto", async () => {
    const res = await runInboundRespond(lead, deps({ sendMode: "auto" }));
    expect(res.action).toBe("send");
  });

  it("holds an auto-mode draft for review when it has unresolved violations", async () => {
    const d = deps({
      sendMode: "auto",
      draft: vi.fn(async () => ({ body: "we lift replies 60%", violations: [{ rule: "ungrounded-claim", detail: "60%" }] })),
    });
    const res = await runInboundRespond(lead, d);
    expect(res.action).toBe("review");
  });
});
