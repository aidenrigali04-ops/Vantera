import type { LeadInsights, Violation } from "@vantera/agent-brains";
import { toStoredInsights } from "@vantera/agent-brains";
import type {
  InboundRespondJobDeps,
  InboundRespondJobSummary,
  InboundLeadEvent,
  NewScheduledSend,
} from "./types";

/**
 * Phase 12 — Inbound Responder core. The report's most defensible use case is fast inbound
 * response (sub-5-min): when a lead arrives (form-fill / site-visitor / signal) the agent
 * qualifies and drafts a reply immediately, reusing the existing quality gate + copy brain
 * (injected here so this stays a pure, deps-injected pipeline core, rule 13). Speed is the
 * product. Suppression is checked at the boundary before anything is drafted (rule 11).
 *
 * Deferred to the rest of Phase 12 (see roadmap): the inbound_leads table + intake webhook, the
 * trigger wrapper that wires qualify→rules-gate/AI-rank and draft→copy brain, the wizard, help,
 * and copilot tool.
 */
export interface InboundLead {
  accountId: string;
  source: "form_fill" | "website_visitor" | "signal";
  email?: string | null;
  firstName?: string | null;
  companyName?: string | null;
}

export interface InboundDraft {
  subject?: string;
  body: string;
  violations: Violation[];
}

export interface InboundRespondDeps {
  /** auto: send a clean draft immediately (within SLA); review: always queue for approval */
  sendMode: "auto" | "review";
  isSuppressed: (accountId: string, channel: "email", value: string) => Promise<boolean>;
  qualify: (lead: InboundLead) => Promise<{ passed: boolean; score: number }>;
  draft: (lead: InboundLead) => Promise<InboundDraft>;
}

export type InboundRespondAction = "skipped" | "suppressed" | "rejected" | "review" | "send";

export interface InboundRespondResult {
  action: InboundRespondAction;
  reason?: string;
  draft?: InboundDraft;
}

export async function runInboundRespond(
  lead: InboundLead,
  deps: InboundRespondDeps
): Promise<InboundRespondResult> {
  const email = lead.email?.trim().toLowerCase();
  if (!email) return { action: "skipped", reason: "no contact info" };

  // Rule 11: never reach a suppressed contact — checked before drafting.
  if (await deps.isSuppressed(lead.accountId, "email", email)) {
    return { action: "suppressed" };
  }

  // The quality gate is the point — fast does not mean spraying everyone who fills a form.
  const q = await deps.qualify(lead);
  if (!q.passed) return { action: "rejected", reason: "below quality gate" };

  const draft = await deps.draft(lead);
  // Auto-send only a clean draft; anything flagged (e.g. an ungrounded metric) waits in review.
  const action: InboundRespondAction =
    deps.sendMode === "auto" && draft.violations.length === 0 ? "send" : "review";
  return { action, draft };
}

/**
 * The persistence orchestrator around the decision core. Loads the responder's context, records
 * the intake row (SLA tracking), runs runInboundRespond with the real qualify + copy brains, then
 * persists the outcome: a qualified lead becomes a leads row (source 'inbound') + a scheduled_send
 * (auto-mode clean draft → 'approved', everything else → 'pending_review'), and the inbound_leads
 * row is finalized with its responded_at. Pure: all I/O is injected via the store (rule 13).
 */
export async function processInboundLead(
  event: InboundLeadEvent,
  deps: InboundRespondJobDeps
): Promise<InboundRespondJobSummary> {
  const { store } = deps;
  const now = deps.now ?? (() => new Date());

  const ctx = await store.getResponderContext(event.agentId);
  if (!ctx || ctx.agent.status !== "live") {
    return { action: "skipped", inboundLeadId: null };
  }

  const inboundLeadId = await store.recordInbound({
    accountId: event.accountId,
    agentId: event.agentId,
    source: event.source,
    email: event.email,
    firstName: event.firstName,
    companyName: event.companyName,
    payload: event.raw ?? {},
  });

  const email = event.email?.trim().toLowerCase();
  if (!email) {
    await store.finalizeInbound(inboundLeadId, { status: "error" });
    return { action: "skipped", inboundLeadId };
  }

  // Capture the rank insights from the qualify step so we can persist the score + ground the draft.
  let insights: LeadInsights | null = null;
  const decision = await runInboundRespond(
    {
      accountId: event.accountId,
      source: event.source,
      email,
      firstName: event.firstName,
      companyName: event.companyName,
    },
    {
      sendMode: ctx.agent.config.sendMode,
      isSuppressed: (accountId, kind, value) => store.isSuppressed(accountId, kind, value),
      qualify: async () => {
        const q = await deps.qualify(event);
        insights = q.insights;
        return { passed: q.passed, score: q.insights.score };
      },
      draft: async () => {
        const d = await deps.draftEmailFn({
          lead: { firstName: event.firstName, companyName: event.companyName },
          insights: toStoredInsights(insights!),
          context: {
            cta: ctx.cta,
            accountName: ctx.accountName,
            accountIndustry: ctx.accountIndustry,
            valueProp: ctx.valueProp,
          },
        });
        return { subject: d.subject, body: d.body, violations: d.violations };
      },
    }
  );

  if (decision.action === "suppressed") {
    await store.finalizeInbound(inboundLeadId, { status: "suppressed" });
    return { action: "suppressed", inboundLeadId };
  }
  if (decision.action === "rejected") {
    await store.finalizeInbound(inboundLeadId, { status: "rejected" });
    return { action: "rejected", inboundLeadId };
  }

  // review or send: qualified → persist the lead, score, and the drafted reply.
  const leadId = await store.upsertInboundLeadRow({
    accountId: event.accountId,
    email,
    firstName: event.firstName,
    companyName: event.companyName,
  });
  if (insights) await store.saveScore(leadId, insights, true);
  if (ctx.agent.campaignId) {
    await store.ensureCampaignLead(ctx.agent.campaignId, leadId, event.accountId);
  }

  const draft = decision.draft!;
  const send: NewScheduledSend = {
    accountId: event.accountId,
    campaignId: ctx.agent.campaignId ?? "",
    leadId,
    channel: "email",
    subject: draft.subject ?? null,
    body: draft.body,
    status: decision.action === "send" ? "approved" : "pending_review",
    linkedinStage: null,
    styleFlags: draft.violations.length ? JSON.stringify(draft.violations) : null,
  };
  await store.insertScheduledSend(send);

  const status = decision.action === "send" ? "responded" : "review";
  await store.finalizeInbound(inboundLeadId, { status, leadId, respondedAt: now() });
  return { action: status, inboundLeadId, leadId };
}
