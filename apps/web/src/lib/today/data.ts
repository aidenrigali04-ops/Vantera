import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CONNECTION_NOTE_MAX_CHARS, FOLLOWUP_MAX_CHARS } from "@vantera/agent-brains";
import { engineLineFor } from "./engine-line";
import {
  capUsage,
  fmtActivityTime,
  fmtCount,
  fmtDate,
  fmtDayTime,
  fmtRelative,
  fmtSendSlot,
  fmtTime,
  initials,
  nextSendWindow,
  replyRate,
  shortName,
} from "./metrics";
import type { ActivityRow, QueueRow, QueueStep, ReplyClass, ReplyRow, SenderChipRow, StatTile, TodayView } from "./rows";
import { buildStatusSentence } from "./sentence";
import { downSenders, greetingWord, healthySenders, resolveTodayState } from "./state";
import { primaryFor, tilesFor, type TileExtras } from "./tiles";
import type { SenderFacts, TodayInputs, TodayState } from "./types";

/**
 * Today's data contract (blueprint §9): ONE round-trip. Every read below is fired in a
 * single Promise.all on the session's RLS-scoped client — no account id is passed (rule 02)
 * — and every time/relative label is formatted here, on the server, in the account
 * timezone. Derived metrics come from `metrics.ts`; the state machine from `state.ts`.
 *
 * Two reads are fatal (the error boundary): senders and the drafts count. Everything else
 * degrades to empty so a broken stat never takes the page down.
 */

const DAY = 86_400_000;
const QUEUE_LIMIT = 5;
const REPLIES_LIMIT = 5;
const ACTIVITY_LIMIT = 12;

type Row = Record<string, unknown>;

interface LeadLite {
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

interface DraftRaw {
  id: string;
  lead_id: string | null;
  body: string | null;
  style_flags: string | null;
  linkedin_stage: "invite" | "message" | null;
  origin: "sequence" | "reply_response" | "manual" | null;
  created_at: string;
  leads: LeadLite | null;
}

interface ReplyRaw {
  id: string;
  lead_id: string;
  body: string | null;
  classification: string | null;
  classification_rationale: string | null;
  received_at: string;
  leads: Pick<LeadLite, "id" | "first_name" | "last_name" | "company_name" | "status"> | null;
}

interface SenderRaw {
  id: string;
  display_name: string | null;
  status: SenderFacts["status"];
  connected_at: string | null;
  updated_at: string | null;
}

interface AgentRaw {
  kind: "scout" | "copy" | "intent";
  status: "draft" | "live" | "paused";
  last_run_at: string | null;
  next_run_at: string | null;
  timezone: string | null;
}

interface ActivityRaw {
  at: string;
  kind: "sends" | "reply" | "agent_run" | "lead_event" | "drafted" | "approved";
  sender_id: string | null;
  lead_id: string | null;
  payload: Row;
}

export interface TodayLoad {
  view: TodayView;
  inputs: TodayInputs;
  /** the profile row (for the first-session redirect + last-visit stamp) */
  profile: { displayName: string | null; firstSessionDoneAt: string | null };
  accountId: string;
}

function leadName(l: Pick<LeadLite, "first_name" | "last_name" | "company_name"> | null): string {
  if (!l) return "Unknown prospect";
  return [l.first_name, l.last_name].filter(Boolean).join(" ") || l.company_name || "Unknown prospect";
}

type SignalGlyph = NonNullable<QueueRow["signal"]>["glyph"];

function signalGlyph(kind: string | null): SignalGlyph {
  const k = (kind ?? "").toLowerCase();
  if (k.includes("hiring") || k.includes("job")) return "briefcase";
  if (k.includes("post") || k.includes("comment") || k.includes("engag")) return "message-circle";
  if (k.includes("role") || k.includes("promot") || k.includes("title")) return "arrow-up-right";
  if (k.includes("fund") || k.includes("launch") || k.includes("raise")) return "rocket";
  return null;
}

function replyClass(classification: string | null, needsHuman: boolean): ReplyClass {
  if (needsHuman) return "Needs you";
  if (classification === "interested") return "Interested";
  if (classification === "out_of_office") return "Out of office";
  return "Neutral";
}

/** The account timezone: the Prospect agent's configured zone, else UTC. */
function accountTimeZone(agents: AgentRaw[]): string {
  const tz = agents.find((a) => a.kind === "scout")?.timezone ?? agents[0]?.timezone ?? "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

export async function loadToday(supabase: SupabaseClient, userId: string, now = new Date()): Promise<TodayLoad | null> {
  const weekAgo = new Date(now.getTime() - 7 * DAY).toISOString();
  const dayAgo = new Date(now.getTime() - DAY).toISOString();
  // "today" is the ACCOUNT's day, and the timezone is itself one of the reads below — so
  // pull a 36h window here and filter to the local day once the zone is known.
  const sinceYesterdayish = new Date(now.getTime() - 36 * 3_600_000).toISOString();

  const [
    account,
    profile,
    senders,
    agents,
    draftsCountRes,
    draftsRes,
    repliesRes,
    sentWeekRes,
    repliesWeekRes,
    interestedWeekRes,
    meetingsWeekRes,
    nextMeetingRes,
    notesRes,
    activityRes,
    nextSendRes,
    runsRes,
    sendsTodayRes,
    invitesWeekRes,
    approvedTodayRes,
    answeredWeekRes,
  ] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, plan, subscription_status, stripe_subscription_id, paused_at, current_period_end")
      .limit(1)
      .maybeSingle<{
        id: string;
        name: string;
        plan: string;
        subscription_status: string;
        stripe_subscription_id: string | null;
        paused_at: string | null;
        current_period_end: string | null;
      }>(),
    supabase
      .from("user_profiles")
      .select("display_name, last_today_viewed_at, dismissed_asks, first_session_done_at")
      .eq("user_id", userId)
      .maybeSingle<{
        display_name: string | null;
        last_today_viewed_at: string | null;
        dismissed_asks: Record<string, string> | null;
        first_session_done_at: string | null;
      }>(),
    supabase.from("linkedin_accounts").select("id, display_name, status, connected_at, updated_at").returns<SenderRaw[]>(),
    supabase.from("agents").select("kind, status, last_run_at, next_run_at, timezone").returns<AgentRaw[]>(),
    supabase.from("scheduled_sends").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
    // Queue: reply responses first (speed-to-lead), then invites, then follow-ups; score desc inside.
    supabase
      .from("scheduled_sends")
      .select(
        "id, lead_id, body, style_flags, linkedin_stage, origin, created_at, leads(id, first_name, last_name, title, company_name, location, ai_score, ai_rationale, ai_insights, linkedin_url, status, linkedin_account_id)"
      )
      .eq("status", "pending_review")
      .order("created_at", { ascending: true })
      .limit(60)
      .returns<DraftRaw[]>(),
    // Replies that may be waiting (interested / neutral / other); the waiting rule is applied below.
    supabase
      .from("replies")
      .select("id, lead_id, body, classification, classification_rationale, received_at, leads(id, first_name, last_name, company_name, status)")
      .in("classification", ["interested", "neutral", "other"])
      .order("received_at", { ascending: true })
      .limit(60)
      .returns<ReplyRaw[]>(),
    supabase.from("outreach_sends").select("id", { count: "exact", head: true }).gte("sent_at", weekAgo),
    supabase.from("replies").select("id", { count: "exact", head: true }).gte("received_at", weekAgo),
    supabase.from("replies").select("id", { count: "exact", head: true }).eq("classification", "interested").gte("received_at", weekAgo),
    supabase.from("leads").select("id", { count: "exact", head: true }).gte("meeting_booked_at", weekAgo),
    supabase
      .from("leads")
      .select("id, first_name, last_name, company_name, meeting_at, meeting_booked_at")
      .gte("meeting_at", now.toISOString())
      .order("meeting_at", { ascending: true })
      .limit(1)
      .maybeSingle<{ id: string; first_name: string | null; last_name: string | null; company_name: string | null; meeting_at: string; meeting_booked_at: string | null }>(),
    supabase
      .from("lead_notifications")
      .select("id, kind, lead_id, created_at, leads(id, first_name, last_name, company_name)")
      .in("kind", ["needs_human"])
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .returns<{ id: string; kind: string; lead_id: string; created_at: string; leads: Pick<LeadLite, "id" | "first_name" | "last_name" | "company_name"> | null }[]>(),
    supabase.from("today_activity").select("at, kind, sender_id, lead_id, payload").gte("at", dayAgo).order("at", { ascending: false }).limit(ACTIVITY_LIMIT).returns<ActivityRaw[]>(),
    supabase
      .from("scheduled_sends")
      .select("scheduled_for")
      .in("status", ["approved", "scheduled"])
      .gte("scheduled_for", now.toISOString())
      .order("scheduled_for", { ascending: true })
      .limit(1)
      .maybeSingle<{ scheduled_for: string | null }>(),
    supabase.from("agent_runs").select("kind, status, summary, started_at").eq("kind", "scout").order("started_at", { ascending: false }).limit(3).returns<{ kind: string; status: string; summary: Row; started_at: string }[]>(),
    supabase
      .from("outreach_sends")
      .select("linkedin_account_id, sent_at, scheduled_sends(linkedin_stage)")
      .gte("sent_at", sinceYesterdayish)
      .returns<{ linkedin_account_id: string | null; sent_at: string; scheduled_sends: { linkedin_stage: string | null } | null }[]>(),
    supabase
      .from("outreach_sends")
      .select("linkedin_account_id, scheduled_sends(linkedin_stage)")
      .gte("sent_at", weekAgo)
      .returns<{ linkedin_account_id: string | null; scheduled_sends: { linkedin_stage: string | null } | null }[]>(),
    supabase.from("scheduled_sends").select("approved_at").gte("approved_at", sinceYesterdayish).returns<{ approved_at: string }[]>(),
    supabase.from("replies").select("id", { count: "exact", head: true }).gte("received_at", weekAgo).in("classification", ["interested", "neutral", "other"]),
  ]);

  if (!account.data) return null;
  // Fatal reads (blueprint §8): the senders list and the drafts count.
  if (senders.error) throw new Error(`today: senders read failed: ${senders.error.message}`);
  if (draftsCountRes.error) throw new Error(`today: drafts count failed: ${draftsCountRes.error.message}`);

  const agentRows = agents.data ?? [];
  const tz = accountTimeZone(agentRows);
  const acct = account.data;
  const prof = profile.data;
  const todayKey = fmtDate(now, tz);
  const isToday = (iso: string) => fmtDate(new Date(iso), tz) === todayKey;

  // ── senders ─────────────────────────────────────────────────────────────────
  const todaySends = (sendsTodayRes.data ?? []).filter((x) => isToday(x.sent_at));
  const approvedToday = (approvedTodayRes.data ?? []).filter((x) => isToday(x.approved_at)).length;
  const weekSends = invitesWeekRes.data ?? [];
  const senderFacts: SenderFacts[] = (senders.data ?? []).map((s) => {
    const mine = todaySends.filter((x) => x.linkedin_account_id === s.id);
    return {
      id: s.id,
      name: shortName(s.display_name),
      status: s.status,
      ageDays: s.connected_at ? Math.max(0, (now.getTime() - new Date(s.connected_at).getTime()) / DAY) : 0,
      invitesToday: mine.filter((x) => x.scheduled_sends?.linkedin_stage === "invite").length,
      messagesToday: mine.filter((x) => x.scheduled_sends?.linkedin_stage !== "invite").length,
      invitesThisWeek: weekSends.filter((x) => x.linkedin_account_id === s.id && x.scheduled_sends?.linkedin_stage === "invite").length,
      statusChangedAt: s.status === "disconnected" || s.status === "restricted" ? s.updated_at : null,
    };
  });
  const down = downSenders(senderFacts);
  const downIds = new Set(down.map((d) => d.id));
  const senderName = new Map(senderFacts.map((s) => [s.id, s.name]));

  // ── drafts (the queue) ───────────────────────────────────────────────────────
  const drafts = draftsRes.data ?? [];
  const draftsTotal = draftsCountRes.count ?? 0;
  const draftsHeld = drafts.filter((d) => d.leads?.linkedin_account_id && downIds.has(d.leads.linkedin_account_id)).length;
  // step = position in the lead's sequence: invites are "Invite"; messages are "Follow-up N"
  // by the number of earlier message-stage drafts/sends for the same lead in this queue set.
  const messageIndexByLead = new Map<string, number>();
  const ordered = [...drafts].sort((a, b) => {
    const rank = (d: DraftRaw) => (d.origin === "reply_response" ? 0 : d.linkedin_stage === "invite" ? 1 : 2);
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    return (b.leads?.ai_score ?? 0) - (a.leads?.ai_score ?? 0);
  });
  const queueRows: QueueRow[] = ordered.slice(0, QUEUE_LIMIT).map((d) => {
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
      evidence: [
        ...(lead?.ai_insights?.triggers ?? []).slice(0, 2).map((t) => ({ text: t })),
        ...(lead?.ai_insights?.pain_points ?? []).slice(0, 2).map((t) => ({ text: t })),
      ].slice(0, 4),
      rationale: lead?.ai_rationale ?? null,
      charLimit: step === "Invite" ? CONNECTION_NOTE_MAX_CHARS : FOLLOWUP_MAX_CHARS,
      linkedinUrl: lead?.linkedin_url ?? null,
    };
  });

  // top signal per queued lead (one lateral-style read, bounded to the surfaced rows)
  const queueLeadIds = queueRows.map((r) => r.leadId).filter((x): x is string => Boolean(x));
  if (queueLeadIds.length > 0) {
    const { data: signals } = await supabase
      .from("lead_signals")
      .select("lead_id, kind, label, observed_at")
      .in("lead_id", queueLeadIds)
      .order("observed_at", { ascending: false })
      .returns<{ lead_id: string; kind: string | null; label: string; observed_at: string | null }[]>();
    const top = new Map<string, { kind: string | null; label: string; observed_at: string | null }>();
    for (const s of signals ?? []) if (!top.has(s.lead_id)) top.set(s.lead_id, s);
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
  }

  // ── replies waiting (the repo's rule: no delivered message after the reply; not converted) ──
  const candidates = (repliesRes.data ?? []).filter((r) => r.leads?.status !== "converted");
  const candidateLeadIds = [...new Set(candidates.map((r) => r.lead_id))];
  const { data: sentAfter } = candidateLeadIds.length
    ? await supabase
        .from("scheduled_sends")
        .select("lead_id, updated_at")
        .in("lead_id", candidateLeadIds)
        .eq("status", "sent")
        .eq("linkedin_stage", "message")
        .returns<{ lead_id: string; updated_at: string }[]>()
    : { data: [] as { lead_id: string; updated_at: string }[] };
  const lastSentByLead = new Map<string, number>();
  for (const s of sentAfter ?? []) {
    const t = new Date(s.updated_at).getTime();
    if (t > (lastSentByLead.get(s.lead_id) ?? 0)) lastSentByLead.set(s.lead_id, t);
  }
  const waiting = candidates.filter((r) => (lastSentByLead.get(r.lead_id) ?? 0) <= new Date(r.received_at).getTime());
  // one row per lead (oldest reply per lead first — the one going cold)
  const seenLead = new Set<string>();
  const waitingByLead = waiting.filter((r) => (seenLead.has(r.lead_id) ? false : (seenLead.add(r.lead_id), true)));
  const waitingLeadIds = waitingByLead.map((r) => r.lead_id);
  const { data: replyDrafts } = waitingLeadIds.length
    ? await supabase
        .from("scheduled_sends")
        .select("lead_id")
        .in("lead_id", waitingLeadIds)
        .eq("origin", "reply_response")
        .eq("status", "pending_review")
        .returns<{ lead_id: string }[]>()
    : { data: [] as { lead_id: string }[] };
  const hasReplyDraft = new Set((replyDrafts ?? []).map((d) => d.lead_id));
  const needsHumanLeadIds = new Set((notesRes.data ?? []).map((n) => n.lead_id));
  const replyRows: ReplyRow[] = waitingByLead.slice(0, REPLIES_LIMIT).map((r) => {
    const name = leadName(r.leads);
    const body = (r.body ?? "").replace(/\s+/g, " ").trim();
    const rationale = (r.classification_rationale ?? "").trim();
    const isDraft = hasReplyDraft.has(r.lead_id);
    return {
      id: r.id,
      leadId: r.lead_id,
      name,
      company: r.leads?.company_name ?? null,
      initials: initials(name),
      excerpt: body.length > 90 ? `${body.slice(0, 89)}…` : body,
      note: isDraft ? "Draft reply ready · approval needed" : rationale ? (rationale.length > 60 ? `${rationale.slice(0, 59)}…` : rationale) : null,
      noteIsDraft: isDraft,
      klass: replyClass(r.classification, needsHumanLeadIds.has(r.lead_id)),
      received: fmtRelative(new Date(r.received_at), now),
    };
  });
  const repliesWaiting = waitingByLead.length;
  const repliesInterestedWaiting = waitingByLead.filter((r) => r.classification === "interested").length;

  // ── engine facts ─────────────────────────────────────────────────────────────
  const scout = agentRows.find((a) => a.kind === "scout");
  const copy = agentRows.find((a) => a.kind === "copy");
  const runs = runsRes.data ?? [];
  const lastThreeRunsEmpty =
    runs.length >= 3 && runs.every((r) => r.status === "completed" && Number((r.summary as Row)?.qualified ?? 0) === 0);
  const firstRunAt = scout?.last_run_at ?? runs[runs.length - 1]?.started_at ?? null;
  const everDrafted = draftsTotal > 0 || approvedToday > 0 || (activityRes.data ?? []).some((a) => a.kind === "drafted" || a.kind === "sends");
  // "First session" means a brand-new workspace that has never worked a queue — for those,
  // the post-payment landing is the queue itself (blueprint §8). It must NOT capture an
  // established account: `first_session_done_at` only exists from migration 0063 on, so every
  // account that predates it has the flag unset and would otherwise be bounced off its own
  // home page forever. Any real history is proof the first session is long over.
  const hasHistory =
    everDrafted ||
    (sentWeekRes.count ?? 0) > 0 ||
    (repliesWeekRes.count ?? 0) > 0 ||
    (meetingsWeekRes.count ?? 0) > 0 ||
    (activityRes.data ?? []).length > 0;

  const inputs: TodayInputs = {
    now,
    timeZone: tz,
    firstSessionDone: Boolean(prof?.first_session_done_at) || hasHistory,
    drafts: draftsTotal,
    draftsHeld,
    repliesWaiting,
    repliesInterestedWaiting,
    oldestWaitingAt: waitingByLead[0]?.received_at ?? null,
    senders: senderFacts,
    pausedAt: acct.paused_at,
    billing: {
      status: (["none", "trialing", "active", "past_due", "canceled"].includes(acct.subscription_status) ? acct.subscription_status : "none") as TodayInputs["billing"]["status"],
      plan: acct.plan,
      pastDueSince: acct.subscription_status === "past_due" ? acct.current_period_end : null,
      canceledAt: acct.subscription_status === "canceled" ? acct.current_period_end : null,
    },
    engine: {
      scoutLive: scout?.status === "live",
      firstRunAt,
      lastRunAt: scout?.last_run_at ?? null,
      nextRunAt: copy?.next_run_at ?? scout?.next_run_at ?? null,
      everDrafted,
      lastThreeRunsEmpty,
    },
    lastVisitAt: prof?.last_today_viewed_at ?? null,
  };

  const state: TodayState = resolveTodayState(inputs);

  // ── tiles + primary ──────────────────────────────────────────────────────────
  const topDraft = queueRows[0] ?? null;
  const topDraftRaw = topDraft ? ordered.find((d) => d.id === topDraft.id) : null;
  const needsHuman = (notesRes.data ?? [])[0] ?? null;
  const nextMeeting = nextMeetingRes.data;
  const meetingIsToday = nextMeeting ? fmtActivityTime(new Date(nextMeeting.meeting_at), now, tz) === fmtTime(new Date(nextMeeting.meeting_at), tz) : false;
  const extras: TileExtras = {
    topScore: topDraft?.score ?? null,
    topDraftLocation: topDraftRaw?.leads?.location ?? null,
    topDraftSender: topDraft?.sends.sender ?? null,
    needsHuman: needsHuman
      ? { leadId: needsHuman.lead_id, name: leadName(needsHuman.leads), company: needsHuman.leads?.company_name ?? null }
      : null,
    meetingToday:
      nextMeeting && meetingIsToday
        ? {
            leadId: nextMeeting.id,
            name: leadName(nextMeeting),
            company: nextMeeting.company_name,
            at: nextMeeting.meeting_at,
            bookedAt: nextMeeting.meeting_booked_at,
          }
        : null,
    // the two learning loops' suggestion tables land with the Playbook blueprint
    playbookSuggestion: null,
    styleSuggestion: null,
    crmHandoff: null,
    calendarLink: null,
    dismissedAsks: prof?.dismissed_asks ?? {},
  };
  const tiles = tilesFor(inputs, extras);
  const primary = primaryFor(tiles);

  // ── stats (7 days) ───────────────────────────────────────────────────────────
  const sent7 = sentWeekRes.count ?? 0;
  const replies7 = repliesWeekRes.count ?? 0;
  const interested7 = interestedWeekRes.count ?? 0;
  const meetings7 = meetingsWeekRes.count ?? 0;
  const rate = replyRate(replies7, sent7);
  const healthyCount = healthySenders(senderFacts).length;
  const stats: TodayView["stats"] = [
    {
      label: "Sent · 7 days",
      value: fmtCount(sent7),
      note: sent7 === 0 ? "none yet" : `‹${todaySends.length}› today · ‹${healthyCount}› ${healthyCount === 1 ? "sender" : "senders"}`,
    },
    { label: "Replies · 7 days", value: fmtCount(replies7), note: replies7 === 0 ? "none yet" : rate === null ? "— of sends" : `‹${rate.toFixed(1)}%› of sends` },
    {
      label: "Interested · 7 days",
      value: fmtCount(interested7),
      note: interested7 === 0 ? "none yet" : repliesInterestedWaiting > 0 ? `‹${repliesInterestedWaiting}› waiting on you` : "all answered",
    },
    {
      label: "Meetings · 7 days",
      value: fmtCount(meetings7),
      note: nextMeeting ? `next ‹${fmtDayTime(new Date(nextMeeting.meeting_at), tz)}›` : meetings7 === 0 ? "none yet" : "none scheduled",
    },
  ];

  // ── banner (engine-stopping states only; sender outranks billing) ───────────
  let banner: TodayView["banner"] = null;
  if (state === "stopped_senders") {
    banner = { tone: "danger", message: "No sender is connected. The engine is still sourcing and drafting; nothing can send until one is back.", cta: { label: "Reconnect", href: "/settings/senders" } };
  } else if (state === "sender_held") {
    const d = down[0]!;
    banner =
      d.status === "restricted"
        ? { tone: "attention", message: `LinkedIn has restricted ${d.name}. Sending from it is paused; approvals stay open. Check the account in LinkedIn, then mark it resolved here.`, cta: { label: "Open sender", href: `/settings/senders#${d.id}` } }
        : {
            tone: "attention",
            message: `${d.name} lost its LinkedIn connection${d.statusChangedAt ? ` at ${fmtTime(new Date(d.statusChangedAt), tz)}` : ""}. Nothing sends from it until you reconnect — drafts are held, not lost.`,
            cta: { label: `Reconnect ${d.name}`, href: `/settings/senders#${d.id}` },
          };
  } else if (state === "stopped_billing") {
    banner =
      acct.subscription_status === "canceled"
        ? { tone: "danger", message: `Your subscription ended${inputs.billing.canceledAt ? ` on ${fmtDayTime(new Date(inputs.billing.canceledAt), tz).split(" ")[0]}` : ""}. The engine is stopped; your prospects and drafts are kept for 60 days.`, cta: { label: "Restart subscription", href: "/settings/billing" } }
        : { tone: "danger", message: "Your last payment failed. Sending pauses in 7 days unless the card is updated.", cta: { label: "Update payment", href: "/settings/billing" } };
  }

  // ── senders (chips) ──────────────────────────────────────────────────────────
  const senderChips: SenderChipRow[] = senderFacts.map((s) => {
    const c = capUsage(s);
    const tooltip = [
      `${c.invitesToday} of ${c.invitesAllowed} invites`,
      `${c.messagesToday} of ${c.messagesAllowed} messages today`,
      `${c.invitesThisWeek} of ${c.weeklyCeiling} invites this week`,
      c.warmup ? `day ${c.warmupDay} of 28 · ramp ${c.invitesAllowed}/day` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return { id: s.id, name: s.name, status: s.status, fraction: `${c.sentToday}/${c.allowedToday}`, warmup: c.warmup, tooltip };
  });

  // ── activity (24h) ───────────────────────────────────────────────────────────
  const activityLeadIds = [...new Set((activityRes.data ?? []).map((a) => a.lead_id).filter((x): x is string => Boolean(x)))];
  const { data: activityLeads } = activityLeadIds.length
    ? await supabase.from("leads").select("id, first_name, last_name, company_name").in("id", activityLeadIds).returns<Pick<LeadLite, "id" | "first_name" | "last_name" | "company_name">[]>()
    : { data: [] as Pick<LeadLite, "id" | "first_name" | "last_name" | "company_name">[] };
  const activityLeadName = new Map((activityLeads ?? []).map((l) => [l.id, leadName(l)]));
  const activity: ActivityRow[] = (activityRes.data ?? []).map((a, i) => {
    const time = fmtActivityTime(new Date(a.at), now, tz);
    const p = a.payload ?? {};
    const lead = a.lead_id ? { text: activityLeadName.get(a.lead_id) ?? "A prospect", href: `/prospects/${a.lead_id}`, strong: true } : null;
    switch (a.kind) {
      case "sends": {
        const inv = Number(p.invites ?? 0);
        const msg = Number(p.messages ?? 0);
        const parts = [{ text: "Sent " }, { text: String(inv), mono: true }, { text: ` invite${inv === 1 ? "" : "s"} and ` }, { text: String(msg), mono: true }, { text: ` message${msg === 1 ? "" : "s"} — inside caps` }];
        return { id: `${a.kind}-${i}`, time, parts, actor: (a.sender_id && senderName.get(a.sender_id)) || "Sender" };
      }
      case "reply": {
        const cls = String(p.classification ?? "");
        const label = cls === "interested" ? "Interested" : cls === "not_interested" ? "Not interested" : cls === "out_of_office" ? "Out of office" : cls === "unsubscribe" ? "Unsubscribe" : "Neutral";
        const parts = [{ text: "Reply from " }, lead ?? { text: "a prospect" }, { text: ` classified ${label}` }, ...(cls === "interested" || cls === "not_interested" || cls === "unsubscribe" ? [{ text: " — sequence stopped" }] : [])];
        return { id: `${a.kind}-${i}`, time, parts, actor: "Outreach agent" };
      }
      case "agent_run": {
        const agent = String(p.agent ?? "scout");
        const s = (p.summary ?? {}) as Row;
        const actor = agent === "intent" ? "Intent agent" : "Prospect agent";
        if (p.status === "skipped") return { id: `${a.kind}-${i}`, time, parts: [{ text: "Skipped a pass" }, { text: String(s.reason ? ` — ${String(s.reason).replace(/_/g, " ")}` : "") }], actor };
        if (agent === "intent") {
          return { id: `${a.kind}-${i}`, time, parts: [{ text: "Observed " }, { text: String(s.observed ?? 0), mono: true }, { text: " in-market signals → " }, { text: String(s.qualified ?? 0), mono: true }, { text: " qualified" }], actor };
        }
        return { id: `${a.kind}-${i}`, time, parts: [{ text: "Scored " }, { text: String(s.discovered ?? 0), mono: true }, { text: " new profiles → " }, { text: String(s.qualified ?? 0), mono: true }, { text: " above 70" }], actor };
      }
      case "lead_event": {
        const ev = String(p.event ?? "");
        const verb =
          ev === "meeting_booked" ? " booked a meeting" : ev === "converted" ? " closed — a new client" : ev === "hot_signal" ? " showed a fresh buying signal" : ev === "needs_human" ? " needs you — the agent reached its conversation limit" : ev === "exhausted" ? " went cold after the full sequence" : " replied";
        return { id: `${a.kind}-${i}`, time, parts: [lead ?? { text: "A prospect" }, { text: verb }], actor: ev === "needs_human" ? "Outreach agent" : "Intent agent" };
      }
      case "drafted":
        return { id: `${a.kind}-${i}`, time, parts: [{ text: "Drafted " }, { text: String(p.count ?? 0), mono: true }, { text: " messages for approval" }], actor: "Outreach agent" };
      case "approved":
        return { id: `${a.kind}-${i}`, time, parts: [{ text: "You approved " }, { text: String(p.count ?? 0), mono: true }, { text: " drafts" }], actor: "You" };
    }
    return { id: `x-${i}`, time, parts: [{ text: "Activity" }], actor: "Engine" };
  });

  // ── engine line ──────────────────────────────────────────────────────────────
  const healthy = healthySenders(senderFacts);
  const allowedToday = healthy.reduce((n, s) => n + capUsage(s).allowedToday, 0);
  const engine = engineLineFor(state, inputs, { nextSendAt: nextSendRes.data?.scheduled_for ?? null, sentToday: todaySends.length, allowedToday });

  const nextRunLabel = inputs.engine.nextRunAt ? fmtTime(new Date(inputs.engine.nextRunAt), tz) : null;
  const firstName = (prof?.display_name ?? "").trim().split(/\s+/)[0] ?? "";
  const hourNow = Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false }).format(now)) % 24;
  // Owner's call (2026-08-22): a wave instead of the full stop. This deliberately overrides
  // the blueprint's no-emoji line for the greeting — and only the greeting.
  const greeting = firstName ? `${greetingWord(hourNow)}, ${firstName} 👋` : `${greetingWord(hourNow)} 👋`;

  const defaultTab: TodayView["defaultTab"] = draftsTotal > 0 ? "queue" : repliesWaiting > 0 ? "replies" : "activity";

  const view: TodayView = {
    state,
    greeting,
    sentence: buildStatusSentence(state, inputs),
    primary,
    banner,
    stats,
    tiles,
    nextRunLabel,
    queue: { rows: queueRows, total: draftsTotal, approvedToday },
    replies: { rows: replyRows, total: repliesWaiting, answeredThisWeek: Math.max(0, (answeredWeekRes.count ?? 0) - repliesWaiting) },
    activity: { rows: activity, engineStartedAgo: firstRunAt ? fmtRelative(new Date(firstRunAt), now) : null },
    senders: senderChips,
    engine,
    updatedLabel: fmtTime(now, tz),
    paused: Boolean(acct.paused_at),
    defaultTab,
  };

  return { view, inputs, profile: { displayName: prof?.display_name ?? null, firstSessionDoneAt: prof?.first_session_done_at ?? null }, accountId: acct.id };
}
