/**
 * Today — the Get Started checklist (UX-1, re-specified 2026-10-22). Pure: the facts are
 * derived from existing data by the loader (`checklist-facts.ts`), never from onboarding
 * stamps (onboarding is frozen). Four required steps count toward progress; the calendar /
 * CRM step is optional and never counts. A dismissal is permanent — any timestamp under
 * `GET_STARTED_ASK` hides the checklist for good (the 24 h rule is `tilesFor`'s alone).
 */

export type ChecklistFacts = {
  /** the Prospect agent's targeting was saved (Playbook → Targeting) */
  buyersConfirmed: boolean;
  /** the user judged at least one prospect (a fit verdict or a draft rejection with a reason) */
  prospectsReviewed: boolean;
  /** a LinkedIn sender is active */
  linkedinActive: boolean;
  /** earliest approved-or-later draft */
  firstApprovedAt: string | null;
  calendarOrCrmConnected: boolean;
  /** `user_profiles.dismissed_asks[GET_STARTED_ASK]` */
  dismissedAt: string | null;
};

export type ChecklistStepKey = "buyers" | "prospects" | "linkedin" | "approve" | "connect";

export type ChecklistStep = { key: ChecklistStepKey; label: string; done: boolean; href: string; optional: boolean };

export type Checklist = { steps: ChecklistStep[]; done: number; total: 4; collapsed: boolean; dismissable: boolean } | null;

/** Permanent dismissal key in `user_profiles.dismissed_asks`. */
export const GET_STARTED_ASK = "get_started";

export function checklistFor(f: ChecklistFacts): Checklist {
  if (f.dismissedAt) return null;
  const steps: ChecklistStep[] = [
    { key: "buyers", label: "Confirm your buyers", done: f.buyersConfirmed, href: "/playbook/scout/targeting", optional: false },
    { key: "prospects", label: "Review first prospects", done: f.prospectsReviewed, href: "/prospects", optional: false },
    { key: "linkedin", label: "Connect LinkedIn", done: f.linkedinActive, href: "/settings/senders", optional: false },
    { key: "approve", label: "Approve your first message", done: f.firstApprovedAt !== null, href: "/approvals", optional: false },
    { key: "connect", label: "Connect calendar or CRM", done: f.calendarOrCrmConnected, href: "/settings/integrations", optional: true },
  ];
  const done = steps.filter((s) => !s.optional && s.done).length;
  return { steps, done, total: 4, collapsed: done >= 2, dismissable: done === 4 };
}
