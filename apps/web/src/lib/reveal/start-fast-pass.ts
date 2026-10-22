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

  // Preconditions (RLS reads): an onboarding ICP and a journey still in progress. No
  // LinkedIn connection is required — the fast pass runs before connect/pay. Anything missing → not our moment; the gate handles routing.
  const [{ data: account }, { data: icp }] = await Promise.all([
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
  ]);
  if (!account || account.onboarding_completed_at != null || !icp) {
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

/**
 * Drop the account's reveal_runs row so the next maybeStartFastPass inserts fresh
 * (e.g. the owner changed their ICP and wants a new pass). Service role — the table has
 * no client write policy. `accountId` MUST come from the caller's session (rule 02).
 */
export async function resetRevealRun(accountId: string): Promise<void> {
  // Never trust the caller's id: confirm the session can see this in-progress account (RLS).
  const supabase = await createClient();
  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("id", accountId)
    .is("onboarding_completed_at", null)
    .maybeSingle<{ id: string }>();
  if (!account) return;

  const svc = createServiceClient();
  const { error } = await svc.from("reveal_runs").delete().eq("account_id", accountId);
  if (error) throw new Error("reveal reset failed");
}
