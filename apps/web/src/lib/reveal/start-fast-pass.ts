import "server-only";
import { tasks } from "@trigger.dev/sdk";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Enqueue the pre-payment fast pass exactly once per account (journey v2).
 * Called belt-and-braces from BOTH the /start/linkedin ?connected=1 return and the
 * /reveal page load; the reveal_runs UNIQUE(account_id) index makes the race safe —
 * the second caller hits 23505 and triggers nothing. A previously FAILED run is
 * retried by resetting the same row (never a sibling insert).
 *
 * `accountId` MUST be resolved from the caller's session (rule 02).
 */
export async function maybeStartFastPass(accountId: string): Promise<{ started: boolean }> {
  const supabase = await createClient();

  // Preconditions (RLS reads): an onboarding ICP, a usable LinkedIn connection, and a
  // journey still in progress. Anything missing → not our moment; the gate handles routing.
  const [{ data: account }, { data: icp }, { data: li }] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, onboarding_completed_at")
      .eq("id", accountId)
      .maybeSingle<{ id: string; onboarding_completed_at: string | null }>(),
    supabase
      .from("icps")
      .select("id")
      .eq("account_id", accountId)
      .eq("source", "onboarding")
      .limit(1)
      .maybeSingle<{ id: string }>(),
    supabase
      .from("linkedin_accounts")
      .select("id")
      .eq("account_id", accountId)
      .in("status", ["connecting", "active"])
      .limit(1)
      .maybeSingle<{ id: string }>(),
  ]);
  if (!account || account.onboarding_completed_at != null || !icp || !li) {
    return { started: false };
  }

  const svc = createServiceClient();

  // Retry path: a failed run resets in place (status back to 'queued') and re-triggers.
  const { data: existing } = await svc
    .from("reveal_runs")
    .select("id, status")
    .eq("account_id", accountId)
    .maybeSingle<{ id: string; status: string }>();

  if (existing) {
    if (existing.status !== "failed") return { started: false };
    // Compare-and-swap: the `.select()` makes a zero-row match observable, so two
    // concurrent callers can't both "win" the reset and double-enqueue the run.
    const { data: reset, error: resetErr } = await svc
      .from("reveal_runs")
      .update({ status: "queued", error: null, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .eq("status", "failed")
      .select("id");
    if (resetErr || !reset || reset.length === 0) return { started: false };
    await tasks.trigger(
      "fast-pass",
      { accountId, revealRunId: existing.id },
      { concurrencyKey: accountId }
    );
    return { started: true };
  }

  const { data: inserted, error } = await svc
    .from("reveal_runs")
    .insert({ account_id: accountId })
    .select("id")
    .single<{ id: string }>();
  if (error || !inserted) {
    // 23505 = another caller won the race — the correct outcome. Anything else is a
    // real failure worth seeing in logs rather than a silent no-op.
    if (error && error.code !== "23505") console.error("maybeStartFastPass insert failed:", error);
    return { started: false };
  }

  await tasks.trigger(
    "fast-pass",
    { accountId, revealRunId: inserted.id },
    { concurrencyKey: accountId }
  );
  return { started: true };
}
