import { describeViolations } from "@vantera/agent-brains";
import type { DraftInput, Violation } from "@vantera/agent-brains";
import { normalizeLinkedInUrl } from "./copy-draft";
import { normalizePhone } from "./call-brief";
import type {
  NewScheduledSend,
  SequenceTouchDeps,
  SequenceTouchDispatch,
  SequenceTouchOutcome,
} from "./types";

/** suppression kind per stage: imessage + call both ride the lead's phone value (rule 11). */
const SUPPRESSION_KIND = {
  email: "email",
  linkedin: "linkedin",
  imessage: "phone",
  call: "phone",
} as const;

/** Describe unresolved humanizer violations for the review queue (tolerant of an empty list). */
function flagsFor(violations: Violation[] | undefined): string | null {
  return violations && violations.length > 0 ? describeViolations(violations) : null;
}

/**
 * Draft and insert ONE channel touch for the orchestrator. v1 routing reuses the existing
 * drafters: email -> draftEmailFn; linkedin AND imessage -> draftLinkedInFn (short DM-tone copy
 * fits a text). The suppression re-check at this boundary is the rule-11 send-path gate: it runs
 * BEFORE any draft or insert, so a suppressed lead is never drafted. 'call' never routes here.
 */
export async function runSequenceTouch(
  d: SequenceTouchDispatch,
  deps: SequenceTouchDeps
): Promise<SequenceTouchOutcome> {
  const lead = await deps.store.getDraftableLead(d.accountId, d.leadId);
  if (!lead) return "skipped";

  const value =
    d.stage === "email" ? lead.email : d.stage === "linkedin" ? lead.linkedinUrl : lead.phone;
  if (!value) return "skipped";

  const normalized =
    d.stage === "email"
      ? value.toLowerCase()
      : d.stage === "linkedin"
        ? normalizeLinkedInUrl(value)
        : normalizePhone(value);
  if (await deps.store.isSuppressed(d.accountId, SUPPRESSION_KIND[d.stage], normalized)) {
    return "suppressed";
  }

  const cta = await deps.store.getCampaignCta(d.campaignId);
  const input: DraftInput = {
    lead: {
      firstName: lead.firstName,
      lastName: lead.lastName,
      title: lead.title,
      companyName: lead.companyName,
      industry: lead.industry,
    },
    insights: lead.aiInsights as DraftInput["insights"],
    context: { cta },
  };

  let body: string;
  let subject: string | null = null;
  let styleFlags: string | null = null;
  if (d.stage === "email") {
    const draft = await deps.draftEmailFn(input);
    subject = draft.subject;
    body = draft.body;
    styleFlags = flagsFor(draft.violations);
  } else {
    // linkedin + imessage both use the short-form drafter (DM-length copy)
    const draft = await deps.draftLinkedInFn(input);
    body = draft.connectionNote;
    styleFlags = flagsFor(draft.violations);
  }

  const send: NewScheduledSend = {
    accountId: d.accountId,
    campaignId: d.campaignId,
    leadId: d.leadId,
    channel: d.stage === "call" ? "call" : d.stage, // 'call' never routes here
    subject,
    body,
    status: styleFlags ? "pending_review" : "approved",
    linkedinStage: d.stage === "linkedin" ? "message" : null,
    styleFlags,
  };
  await deps.store.insertScheduledSend(send);
  return "drafted";
}
