import type { LeadEventKind } from "@vantera/transactional-email";

/**
 * L3 moment-of-value emails (spec 2026-07-15): pref check + owner/admin lookup + send,
 * as a pipeline core with injected deps (rule 13) so the trigger wrapper stays thin.
 * Best-effort by contract — callers swallow failures; an email must never sink inbound.
 */

export interface LeadEventEmailTargets {
  emails: string[];
  leadName: string;
  enabled: boolean;
}

export interface LeadEventEmailDeps {
  getTargets(accountId: string, leadId: string): Promise<LeadEventEmailTargets>;
  send(opts: {
    to: string;
    kind: LeadEventKind;
    leadName: string;
    snippet: string;
    url: string;
  }): Promise<void>;
  appUrl: string;
}

const EVENT_PATH: Record<LeadEventKind, (leadId: string) => string> = {
  interested_reply: (id) => `/inbox?lead=${id}`,
  needs_human: (id) => `/inbox?lead=${id}`,
  meeting_booked: () => `/meetings`,
};

export function createLeadEventNotifier(deps: LeadEventEmailDeps) {
  return async (e: {
    kind: LeadEventKind;
    accountId: string;
    leadId: string;
    snippet: string;
  }): Promise<void> => {
    const t = await deps.getTargets(e.accountId, e.leadId);
    if (!t.enabled) return;
    for (const to of t.emails) {
      await deps.send({
        to,
        kind: e.kind,
        leadName: t.leadName,
        snippet: e.snippet.slice(0, 400),
        url: `${deps.appUrl}${EVENT_PATH[e.kind](e.leadId)}`,
      });
    }
  };
}
