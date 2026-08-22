"use server";

import { revalidatePath } from "next/cache";
import { tasks } from "@trigger.dev/sdk";
import { createClient } from "@/lib/supabase/server";
import { optionalDollarsToCents } from "@/lib/validation";
import type { ClosedDeal } from "@vantera/crm-infra";
import { leadSignalLine, type LeadSignalView } from "./lead-value";

export type LeadCrmActionState = { error?: string; success?: string };

interface LeadRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  company_name: string | null;
  company_domain: string | null;
  deal_value_cents: number | null;
  closed_at: string | null;
  source: string | null;
  ai_score: number | null;
  ai_insights: { triggers?: string[]; pain_points?: string[] } | null;
  lead_signals: LeadSignalView[] | null;
}

async function resolveAccountId(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  // account from the RLS-scoped session — never from the form (rule 02)
  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .limit(1)
    .maybeSingle<{ id: string }>();
  return account?.id ?? null;
}

async function loadLead(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leadId: string
): Promise<LeadRow | null> {
  const { data } = await supabase
    .from("leads")
    .select(
      "id, first_name, last_name, email, phone, title, company_name, company_domain, deal_value_cents, closed_at, source, ai_score, ai_insights, lead_signals(kind, label, detail, observed_at)"
    )
    .eq("id", leadId)
    .maybeSingle<LeadRow>();
  return data;
}

function buildClosedDeal(lead: LeadRow): ClosedDeal {
  return {
    leadId: lead.id,
    contact: {
      firstName: lead.first_name ?? undefined,
      lastName: lead.last_name ?? undefined,
      email: lead.email ?? undefined,
      phone: lead.phone ?? undefined,
      title: lead.title ?? undefined,
      company: lead.company_name ?? undefined,
      domain: lead.company_domain ?? undefined,
    },
    dealValueCents: lead.deal_value_cents ?? 0,
    closedAt: lead.closed_at ?? new Date().toISOString(),
    source: "Vantera",
    // Journey context → the note written next to the deal (why-now, score, origin).
    context: {
      score: lead.ai_score,
      whyNow: leadSignalLine(lead.lead_signals, lead.ai_insights),
      origin: lead.source,
    },
    config: {},
  };
}

// Enqueue a push event per eligible active connection + kick the pipeline. next_retry_at is
// set to now so the retry cron is a guaranteed fallback if the inline trigger call fails; the
// pipeline skips an event already marked success, so there's no double-push.
async function enqueuePushes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  accountId: string,
  lead: LeadRow,
  opts: { onlyAutoPush: boolean }
): Promise<number> {
  const { data: conns } = await supabase
    .from("crm_connections")
    .select("id, config")
    .eq("status", "active")
    .returns<Array<{ id: string; config: { autoPush?: boolean } | null }>>();

  const targets = (conns ?? []).filter((c) =>
    opts.onlyAutoPush ? c.config?.autoPush !== false : true
  );
  if (targets.length === 0) return 0;

  const payload = buildClosedDeal(lead);
  const nowIso = new Date().toISOString();
  let count = 0;
  for (const c of targets) {
    const { data: ev } = await supabase
      .from("crm_push_events")
      .insert({
        account_id: accountId,
        connection_id: c.id,
        lead_id: lead.id,
        status: "pending",
        next_retry_at: nowIso,
        payload,
      })
      .select("id")
      .single<{ id: string }>();
    if (!ev) continue;
    try {
      await tasks.trigger("crm-push", { eventId: ev.id });
    } catch {
      // inline trigger failed — the retry cron will pick it up (next_retry_at is due)
    }
    count++;
  }
  return count;
}

// Mark a lead closed-won (status='converted' + value + date), then auto-push to any
// destination with auto-push on. Admins only (RLS leads_manage / crm policies).
export async function markClosedWon(
  _prev: LeadCrmActionState,
  formData: FormData
): Promise<LeadCrmActionState> {
  const leadId = String(formData.get("leadId") ?? "");
  if (!leadId) return { error: "Missing prospect." };
  const parsed = optionalDollarsToCents(String(formData.get("dealValue") ?? ""));
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const accountId = await resolveAccountId(supabase);
  if (!accountId) return { error: "Your session expired. Sign in again." };

  const { error } = await supabase
    .from("leads")
    .update({
      status: "converted",
      closed_at: new Date().toISOString(),
      deal_value_cents: parsed.cents,
    })
    .eq("id", leadId);
  if (error) return { error: "Couldn't mark this deal closed. Try again shortly." };

  const lead = await loadLead(supabase, leadId);
  const pushed = lead ? await enqueuePushes(supabase, accountId, lead, { onlyAutoPush: true }) : 0;

  // T1: real closes get their celebration — the only other writer of `converted`
  // notifications is the inert CTA-token pipeline, so without this a closed-won deal
  // never reached the dashboard's win moment. Best-effort (the close itself is saved).
  await supabase.from("lead_notifications").insert({
    account_id: accountId,
    lead_id: leadId,
    kind: "converted",
    body: "Closed-won.",
  });

  revalidatePath("/prospects");
  revalidatePath("/dashboard");
  return {
    success:
      pushed > 0
        ? `Closed-won — pushing to ${pushed} connected ${pushed === 1 ? "destination" : "destinations"}.`
        : "Marked closed-won.",
  };
}

/**
 * Manual "Mark meeting booked" (L1 meeting layer, spec 2026-07-15). Authoritative writer
 * (source='manual'); booking is an EVENT: queued sends cancel, the sequence stops, and a
 * meeting_booked notification fires — a prospect who booked never gets another scripted nudge.
 * Distinct from closed-won: this records the meeting, not the deal.
 */
export async function markMeetingBookedAction(
  _prev: LeadCrmActionState,
  formData: FormData
): Promise<LeadCrmActionState> {
  const leadId = String(formData.get("leadId") ?? "");
  if (!leadId) return { error: "Missing prospect." };
  const rawWhen = String(formData.get("meetingAt") ?? "").trim();
  const meetingAt = rawWhen ? new Date(rawWhen) : null;
  if (meetingAt && Number.isNaN(meetingAt.getTime())) {
    return { error: "That meeting time doesn't parse — pick it again." };
  }

  const supabase = await createClient();
  const accountId = await resolveAccountId(supabase);
  if (!accountId) return { error: "Your session expired. Sign in again." };

  const { error } = await supabase
    .from("leads")
    .update({
      meeting_booked_at: new Date().toISOString(),
      meeting_at: meetingAt ? meetingAt.toISOString() : null,
      meeting_source: "manual",
    })
    .eq("id", leadId);
  if (error) return { error: "Couldn't record the meeting. Try again shortly." };

  // Outreach stands down (best-effort; RLS-scoped): cancel queued drafts, stop the run.
  await supabase
    .from("scheduled_sends")
    .update({ status: "canceled", error: "meeting booked — outreach stood down" })
    .eq("lead_id", leadId)
    .in("status", ["pending_review", "approved", "scheduled"]);
  await supabase
    .from("sequence_runs")
    .update({ status: "stopped" })
    .eq("lead_id", leadId)
    .eq("status", "active");
  await supabase.from("lead_notifications").insert({
    account_id: accountId,
    lead_id: leadId,
    kind: "meeting_booked",
    body: "manual",
  });

  revalidatePath("/prospects");
  revalidatePath("/dashboard");
  revalidatePath("/meetings");
  return { success: "Meeting recorded — outreach to this prospect stood down." };
}

// Manual push / re-push of an already-closed lead to all active destinations.
export async function pushLeadToCrm(
  _prev: LeadCrmActionState,
  formData: FormData
): Promise<LeadCrmActionState> {
  const leadId = String(formData.get("leadId") ?? "");
  if (!leadId) return { error: "Missing prospect." };

  const supabase = await createClient();
  const accountId = await resolveAccountId(supabase);
  if (!accountId) return { error: "Your session expired. Sign in again." };

  const lead = await loadLead(supabase, leadId);
  if (!lead) return { error: "Prospect not found." };

  const pushed = await enqueuePushes(supabase, accountId, lead, { onlyAutoPush: false });
  if (pushed === 0) {
    return { error: "No connected destination. Connect one in Settings → CRM & integrations." };
  }
  revalidatePath("/prospects");
  return {
    success: `Pushing to ${pushed} ${pushed === 1 ? "destination" : "destinations"}.`,
  };
}
