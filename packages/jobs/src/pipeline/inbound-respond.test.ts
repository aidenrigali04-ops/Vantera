import { describe, expect, it, vi } from "vitest";
import { runInboundRespond, processInboundLead } from "./inbound-respond";
import type { InboundRespondDeps, InboundLead } from "./inbound-respond";
import type {
  InboundRespondJobDeps,
  InboundRespondJobStore,
  ResponderContext,
} from "./types";
import { RESPONDER_DEFAULTS } from "./types";
import type { LeadInsights } from "@vantera/agent-brains";

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

// ── processInboundLead: the persistence orchestrator around the decision core ──
const insights: LeadInsights = {
  lead_id: "x",
  reasoning: "fits ICP",
  score: 84,
  rationale: "strong fit",
  pain_points: ["slow pipeline"],
  triggers: ["filled the contact form"],
  motivations: ["wants demos"],
  value_angle: "fast response",
  aha_moment: "replied in minutes",
  summary: "inbound demo request",
};

function jobCtx(over: Partial<ResponderContext["agent"]> = {}): ResponderContext {
  return {
    agent: {
      id: "agent1",
      accountId: "acc1",
      status: "live",
      campaignId: "camp1",
      config: { ...RESPONDER_DEFAULTS },
      ...over,
    },
    cta: "book a 15-min intro",
    accountName: "Vantera",
    accountIndustry: "B2B SaaS",
    valueProp: "qualified inbound replies",
  };
}

function jobStore(ctx: ResponderContext | null): InboundRespondJobStore {
  return {
    getResponderContext: vi.fn(async () => ctx),
    recordInbound: vi.fn(async () => "inb1"),
    isSuppressed: vi.fn(async () => false),
    upsertInboundLeadRow: vi.fn(async () => "lead1"),
    saveScore: vi.fn(async () => {}),
    ensureCampaignLead: vi.fn(async () => {}),
    insertScheduledSend: vi.fn(async () => {}),
    finalizeInbound: vi.fn(async () => {}),
  };
}

function jobDeps(
  store: InboundRespondJobStore,
  over: Partial<InboundRespondJobDeps> = {}
): InboundRespondJobDeps {
  return {
    store,
    qualify: vi.fn(async () => ({ passed: true, insights })),
    draftEmailFn: vi.fn(async () => ({ subject: "quick idea", body: "Saw your note — worth a look?", violations: [] })),
    now: () => new Date("2026-06-16T12:00:00Z"),
    ...over,
  };
}

const event = {
  accountId: "acc1",
  agentId: "agent1",
  source: "form_fill" as const,
  email: "jordan@acme.com",
  firstName: "Jordan",
  companyName: "Acme",
};

describe("processInboundLead", () => {
  it("skips (no intake row) when the responder is not live", async () => {
    const store = jobStore(jobCtx({ status: "paused" }));
    const res = await processInboundLead(event, jobDeps(store));
    expect(res.action).toBe("skipped");
    expect(store.recordInbound).not.toHaveBeenCalled();
  });

  it("records the intake and errors out with no contact info", async () => {
    const store = jobStore(jobCtx());
    const res = await processInboundLead({ ...event, email: null }, jobDeps(store));
    expect(res.action).toBe("skipped");
    expect(store.recordInbound).toHaveBeenCalled();
    expect(store.finalizeInbound).toHaveBeenCalledWith("inb1", { status: "error" });
    expect(store.upsertInboundLeadRow).not.toHaveBeenCalled();
  });

  it("never responds to a suppressed contact (rule 11)", async () => {
    const store = jobStore(jobCtx());
    store.isSuppressed = vi.fn(async () => true);
    const res = await processInboundLead(event, jobDeps(store));
    expect(res.action).toBe("suppressed");
    expect(store.finalizeInbound).toHaveBeenCalledWith("inb1", { status: "suppressed" });
    expect(store.insertScheduledSend).not.toHaveBeenCalled();
  });

  it("rejects a lead below the quality gate without creating a lead or send", async () => {
    const store = jobStore(jobCtx());
    const res = await processInboundLead(
      event,
      jobDeps(store, { qualify: vi.fn(async () => ({ passed: false, insights })) })
    );
    expect(res.action).toBe("rejected");
    expect(store.upsertInboundLeadRow).not.toHaveBeenCalled();
    expect(store.insertScheduledSend).not.toHaveBeenCalled();
  });

  it("review mode: persists the lead + a pending_review send", async () => {
    const store = jobStore(jobCtx());
    const res = await processInboundLead(event, jobDeps(store));
    expect(res.action).toBe("review");
    expect(res.leadId).toBe("lead1");
    expect(store.saveScore).toHaveBeenCalledWith("lead1", insights, true);
    expect(store.insertScheduledSend).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "email", status: "pending_review", leadId: "lead1", campaignId: "camp1" })
    );
    expect(store.finalizeInbound).toHaveBeenCalledWith(
      "inb1",
      expect.objectContaining({ status: "review", leadId: "lead1" })
    );
  });

  it("auto mode + clean draft: approves the send within SLA (status responded)", async () => {
    const store = jobStore(jobCtx({ config: { ...RESPONDER_DEFAULTS, sendMode: "auto" } }));
    const res = await processInboundLead(event, jobDeps(store));
    expect(res.action).toBe("responded");
    expect(store.insertScheduledSend).toHaveBeenCalledWith(
      expect.objectContaining({ status: "approved" })
    );
    expect(store.finalizeInbound).toHaveBeenCalledWith(
      "inb1",
      expect.objectContaining({ status: "responded", respondedAt: expect.any(Date) })
    );
  });

  it("auto mode + flagged draft: holds for review, carries style flags", async () => {
    const store = jobStore(jobCtx({ config: { ...RESPONDER_DEFAULTS, sendMode: "auto" } }));
    const res = await processInboundLead(
      event,
      jobDeps(store, {
        draftEmailFn: vi.fn(async () => ({
          subject: "s",
          body: "we lift replies 60%",
          violations: [{ rule: "ungrounded-claim", detail: "60%" }],
        })),
      })
    );
    expect(res.action).toBe("review");
    expect(store.insertScheduledSend).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending_review", styleFlags: expect.any(String) })
    );
  });
});
