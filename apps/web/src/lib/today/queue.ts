import { CONNECTION_NOTE_MAX_CHARS, FOLLOWUP_MAX_CHARS } from "@vantera/agent-brains";
import { fmtRelative, fmtSendSlot, initials, nextSendWindow } from "./metrics";
import type { QueueRow, QueueStep } from "./rows";
import { healthySenders } from "./state";
import type { SenderFacts } from "./types";

/** The shared queue builder (Today's top-5 and the Approvals page both use it). Pure — no I/O. */

export interface QueueLeadIn {
  id: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  company_name: string | null;
  location: string | null;
  ai_score: number | null;
  ai_rationale?: string | null;
  ai_insights?: { pain_points?: string[]; triggers?: string[]; summary?: string } | null;
  linkedin_url?: string | null;
  status: string | null;
  linkedin_account_id: string | null;
}

export interface QueueSendIn {
  id: string;
  lead_id: string | null;
  body: string | null;
  style_flags: string | null;
  linkedin_stage: "invite" | "message" | null;
  origin: "sequence" | "reply_response" | "manual" | null;
  created_at: string;
  leads: QueueLeadIn | null;
}

export interface SignalRowIn {
  lead_id: string;
  kind: string | null;
  label: string;
  observed_at: string | null;
}

type SignalGlyph = NonNullable<QueueRow["signal"]>["glyph"];

export function leadName(l: Pick<QueueLeadIn, "first_name" | "last_name" | "company_name"> | null): string {
  if (!l) return "Unknown prospect";
  return [l.first_name, l.last_name].filter(Boolean).join(" ") || l.company_name || "Unknown prospect";
}

export function signalGlyph(kind: string | null): SignalGlyph {
  const k = (kind ?? "").toLowerCase();
  if (k.includes("hiring") || k.includes("job")) return "briefcase";
  if (k.includes("post") || k.includes("comment") || k.includes("engag")) return "message-circle";
  if (k.includes("role") || k.includes("promot") || k.includes("title")) return "arrow-up-right";
  if (k.includes("fund") || k.includes("launch") || k.includes("raise")) return "banknote";
  return null;
}

/**
 * Order: reply responses first (speed-to-lead), then invites, then follow-ups; score desc
 * inside. `signals` must be ordered newest-first (the first per lead is the top signal).
 * `limit: null` returns every row.
 */
export function buildQueueRows(args: {
  sends: QueueSendIn[];
  signals: SignalRowIn[];
  downSenderIds: Set<string>;
  now: Date;
  limit: number | null;
  /** account timezone for the send-slot label */
  timeZone: string;
  /** all senders (name lookup + the healthy-sender fallback) */
  senders: SenderFacts[];
}): QueueRow[] {
  const { sends, signals, downSenderIds: downIds, now, limit, timeZone: tz, senders: senderFacts } = args;
  const senderName = new Map(senderFacts.map((s) => [s.id, s.name]));
  // step = position in the lead's sequence: invites are "Invite"; messages are "Follow-up N"
  // by the number of earlier message-stage drafts/sends for the same lead in this queue set.
  const messageIndexByLead = new Map<string, number>();
  const ordered = [...sends].sort((a, b) => {
    const rank = (d: QueueSendIn) => (d.origin === "reply_response" ? 0 : d.linkedin_stage === "invite" ? 1 : 2);
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    return (b.leads?.ai_score ?? 0) - (a.leads?.ai_score ?? 0);
  });
  const queueRows: QueueRow[] = (limit === null ? ordered : ordered.slice(0, limit)).map((d) => {
    const lead = d.leads;
    const name = leadName(lead);
    let step: QueueStep;
    if (d.origin === "reply_response") step = "Reply";
    else if (d.linkedin_stage === "invite") step = "Invite";
    else {
      const n = (messageIndexByLead.get(d.lead_id ?? d.id) ?? 0) + 1;
      messageIndexByLead.set(d.lead_id ?? d.id, n);
      step = n >= 3 ? "Follow-up 3" : n === 2 ? "Follow-up 2" : "Follow-up 1";
    }
    const senderId = lead?.linkedin_account_id ?? healthySenders(senderFacts)[0]?.id ?? null;
    const held = senderId ? downIds.has(senderId) : false;
    const slot = nextSendWindow(now, lead?.location);
    return {
      id: d.id,
      leadId: lead?.id ?? null,
      name,
      context: [lead?.title, lead?.company_name].filter(Boolean).join(" · "),
      initials: initials(name),
      signal: null, // filled below from lead_signals
      signalFallback: step === "Invite" ? null : "Follow-up due",
      score: lead?.ai_score ?? null,
      step,
      sends: { label: held ? "held" : fmtSendSlot(slot, tz), sender: senderId ? (senderName.get(senderId) ?? null) : null, held },
      body: d.body ?? "",
      styleFlags: d.style_flags,
      channel: "linkedin",
      origin: d.origin ?? "sequence",
      evidence: [
        ...(lead?.ai_insights?.triggers ?? []).slice(0, 2).map((t) => ({ text: t })),
        ...(lead?.ai_insights?.pain_points ?? []).slice(0, 2).map((t) => ({ text: t })),
      ].slice(0, 4),
      rationale: lead?.ai_rationale ?? null,
      charLimit: step === "Invite" ? CONNECTION_NOTE_MAX_CHARS : FOLLOWUP_MAX_CHARS,
      linkedinUrl: lead?.linkedin_url ?? null,
    };
  });

  const top = new Map<string, SignalRowIn>();
  for (const s of signals) if (!top.has(s.lead_id)) top.set(s.lead_id, s);
  for (const r of queueRows) {
    const s = r.leadId ? top.get(r.leadId) : undefined;
    if (s) {
      r.signal = {
        label: s.label.length > 28 ? `${s.label.slice(0, 27)}…` : s.label,
        age: s.observed_at ? fmtRelative(new Date(s.observed_at), now) : "",
        glyph: signalGlyph(s.kind),
      };
      r.evidence = [{ text: s.label, href: r.linkedinUrl ?? undefined }, ...r.evidence].slice(0, 4);
    }
  }
  return queueRows;
}

/** 1-based page slice; out-of-range pages yield []. */
export function pageSlice<T>(rows: T[], page: number, per: number): T[] {
  return rows.slice((page - 1) * per, page * per);
}
