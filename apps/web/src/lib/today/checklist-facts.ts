import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChecklistFacts } from "./checklist";

/** The checklist facts that need their own reads (senders + dismissal are already loaded). */
export type ChecklistDataFacts = Pick<ChecklistFacts, "buyersConfirmed" | "prospectsReviewed" | "firstApprovedAt" | "calendarOrCrmConnected">;

const APPROVED_OR_LATER = ["approved", "scheduled", "sending", "sent"];

/**
 * Derive the Get Started facts from existing data (no onboarding stamps — onboarding is
 * frozen). Every read runs on the caller's RLS-scoped client; when an `accountId` from the
 * validated session is given (the copilot path), each read is also pinned to it explicitly.
 * Each read is a bounded `limit(1)` existence probe; a failed read degrades to "not done".
 */
export async function readChecklistFacts(db: SupabaseClient, accountId?: string): Promise<ChecklistDataFacts> {
  // `match({})` adds no filter, so the Today path stays purely RLS-scoped (rule 02).
  const own = accountId ? { account_id: accountId } : {};

  const [scout, feedback, rejected, firstApproved, meeting, crm] = await Promise.all([
    db.from("agents").select("targeting:config->targeting").match(own).eq("kind", "scout").limit(1).maybeSingle<{ targeting: unknown }>(),
    db.from("lead_feedback").select("id").match(own).limit(1),
    db.from("scheduled_sends").select("id").match(own).not("rejection_reason", "is", null).limit(1),
    db
      .from("scheduled_sends")
      .select("created_at")
      .match(own)
      .in("status", APPROVED_OR_LATER)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<{ created_at: string }>(),
    db.from("meeting_connections").select("id").match(own).eq("status", "active").limit(1),
    db.from("crm_connections").select("id").match(own).eq("status", "active").eq("kind", "crm").limit(1),
  ]);

  const t = scout.data?.targeting;
  return {
    buyersConfirmed: typeof t === "object" && t !== null && !Array.isArray(t),
    prospectsReviewed: (feedback.data?.length ?? 0) > 0 || (rejected.data?.length ?? 0) > 0,
    firstApprovedAt: firstApproved.data?.created_at ?? null,
    calendarOrCrmConnected: (meeting.data?.length ?? 0) > 0 || (crm.data?.length ?? 0) > 0,
  };
}
