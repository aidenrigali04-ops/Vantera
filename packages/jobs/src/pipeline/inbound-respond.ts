import type { Violation } from "@vantera/agent-brains";

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
