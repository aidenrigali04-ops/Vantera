"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { draftFirstSubject, parseSubjectForm, subjectConfig, type SubjectDraft } from "@vantera/jobs/pipeline/subject";
import { createClient } from "@/lib/supabase/server";
import { hasActivePlan, loadBillingRow } from "@/lib/billing/entitlement";

export type SubjectActionState = { error?: string };

async function sessionAccount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, account: null };
  const { data: account } = await supabase
    .from("accounts")
    .select("id, name")
    .limit(1)
    .maybeSingle<{ id: string; name: string }>();
  return { supabase, user, account };
}

async function insertSubject(
  draft: SubjectDraft
): Promise<SubjectActionState | never> {
  const { supabase, user, account } = await sessionAccount();
  if (!user || !account) return { error: "Your session expired. Sign in again." };
  if (!user.email_confirmed_at) {
    return { error: "Confirm your email before starting learning." };
  }
  const billingRow = await loadBillingRow(supabase);
  if (!hasActivePlan(billingRow)) redirect("/settings/billing?reason=deploy");

  const { error } = await supabase.from("agents").insert({
    account_id: account.id,
    kind: "optimizer",
    name: draft.name,
    status: "live",
    config: subjectConfig(draft),
    cadence: "daily",
    timezone: "UTC",
    deployed_at: new Date().toISOString(),
    created_by: user.id,
  });
  if (error) {
    if (error.code === "23505") return { error: "You already have a subject." };
    return { error: "Could not create the subject. Only workspace admins can do this." };
  }
  revalidatePath("/learning");
  redirect("/learning");
}

export async function createSubject(_prev: SubjectActionState, formData: FormData): Promise<SubjectActionState> {
  const parsed = parseSubjectForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  return insertSubject(parsed.values);
}

export async function createAssistedSubject(): Promise<void> {
  const { account } = await sessionAccount();
  const draft = draftFirstSubject(account?.name);
  const result = await insertSubject(draft);
  if (result?.error) redirect(`/learning?error=${encodeURIComponent(result.error)}`);
}

export async function setSubjectStatus(status: "live" | "paused"): Promise<void> {
  const { supabase, user, account } = await sessionAccount();
  if (!user || !account) redirect("/learning?error=Your%20session%20expired.%20Sign%20in%20again.");
  const { error } = await supabase
    .from("agents")
    .update({
      status,
      ...(status === "live" ? { next_run_at: null } : {}),
    })
    .eq("account_id", account.id)
    .eq("kind", "optimizer");
  if (error) redirect("/learning?error=Could%20not%20update%20the%20subject.");
  revalidatePath("/learning");
  redirect("/learning");
}
