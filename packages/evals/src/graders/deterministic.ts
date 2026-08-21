import {
  validateLinkedInDraft,
  validateConversationMessage,
  allowedConversationLinks,
  findActionClaims,
  findUnapprovedLinks,
  findUngroundedClaims,
  type LinkedInDraft,
  type ConversationDraft,
  type Violation,
} from "@vantera/agent-brains";
import type { CopyLinkedinCase, CopyRespondCase } from "../corpus";

/**
 * The deterministic quality gate (Phase 2B, Task 4) — the hard, no-model copy lint. Every
 * generated (or frozen) draft is re-linted with the EXACT production graders the drafting brains
 * already run internally (`@vantera/agent-brains`), never a re-implementation, so this gate can
 * never drift from what actually ships. Pure and synchronous: given a draft and its corpus case,
 * `gradeLinkedinDraft`/`gradeRespondDraft` compute violations with no I/O and no model call —
 * `run-deterministic.ts` is the only piece that has to await anything (drafting, in "live" mode).
 */

export type GradeResult = {
  caseId: string;
  brain: string;
  violations: Violation[];
  pass: boolean;
};

/**
 * Lints a produced LinkedIn draft with the exact production graders. Brains return camelCase
 * fields (`connectionNote`/`followupMessage`); `validateLinkedInDraft` was written against the
 * generation schema's snake_case shape (`connection_note`/`followup_message`) since it lints the
 * model's raw `generateObject` output before `draftLinkedIn` renames it onto `LinkedInDraft`. This
 * function is the one place that bridges the two — map here, not at every call site.
 *
 * Composition: `validateLinkedInDraft` (humanity + no-links + no-product-pitch + no-meeting-ask +
 * ungrounded claims, all against `c.grounding`) plus two explicit checks the production brain
 * doesn't run for first-touch copy but the gate still wants covered: `findActionClaims` over the
 * note+message (a fabricated "I just joined your group" is exactly as disqualifying on touch 1 as
 * mid-conversation) and `findUnapprovedLinks` over the follow-up (first-touch copy should carry no
 * links at all, so this is a second, independent guard beside the note/message's blanket
 * `no-links` rule — belt and suspenders on the rule the anti-pitch discipline cares most about).
 */
export function gradeLinkedinDraft(
  draft: LinkedInDraft,
  c: CopyLinkedinCase,
  sellerName?: string | null
): GradeResult {
  const built = { connection_note: draft.connectionNote, followup_message: draft.followupMessage };
  const allowed = allowedConversationLinks(c.input.context);
  const violations: Violation[] = [
    ...validateLinkedInDraft(built, c.grounding, sellerName),
    ...findActionClaims(`${draft.connectionNote} ${draft.followupMessage}`),
    ...findUnapprovedLinks(draft.followupMessage, allowed),
  ];
  return { caseId: c.id, brain: "linkedin", violations, pass: violations.length === 0 };
}

/**
 * Lints a produced conversation-reply draft with the exact production graders.
 * `validateConversationMessage` already runs humanity + no-restart + ungrounded-claims +
 * action-claims + unapproved-links internally (see `reply/respond.ts`); this composes it with the
 * standalone `findActionClaims`/`findUngroundedClaims` calls the brief calls out explicitly, so a
 * regression in either check is caught even if `validateConversationMessage`'s internal wiring
 * ever changed. The `block` argument it needs is the case's own `grounding` string (the same
 * `leadBlock` text the frozen draft was hand-verified against), and `allowedLinks` is derived the
 * same way the live brain derives it: `allowedConversationLinks(context)`.
 */
export function gradeRespondDraft(draft: ConversationDraft, c: CopyRespondCase): GradeResult {
  const allowed = allowedConversationLinks(c.input.context);
  const violations: Violation[] = [
    ...validateConversationMessage(draft.message, c.grounding, allowed),
    ...findActionClaims(draft.message),
    ...findUngroundedClaims(draft.message, c.grounding),
  ];
  return { caseId: c.id, brain: "respond", violations, pass: violations.length === 0 };
}
