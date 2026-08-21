"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ProofActionState = { error?: string; added?: boolean };

const KINDS = ["metric", "outcome", "pricing", "faq"] as const;
type Kind = (typeof KINDS)[number];
const TEXT_MAX = 400;

/**
 * Add one citable proof fact. Account comes from the validated session via an RLS-scoped select
 * (rule 02, never the form). The `proof_points_manage` policy is admin-only, so a non-admin insert
 * fails at the DB and surfaces as the admin-only message.
 */
export async function addProofPoint(
  _prev: ProofActionState,
  formData: FormData
): Promise<ProofActionState> {
  const kind = String(formData.get("kind") ?? "") as Kind;
  const text = String(formData.get("text") ?? "").trim();
  const question = formData.get("question") ? String(formData.get("question")).trim() : null;

  if (!KINDS.includes(kind)) return { error: "Pick a type." };
  if (!text) return { error: "Write the fact you want your agent to be able to cite." };
  if (text.length > TEXT_MAX) return { error: `Keep it to one short, quotable line (under ${TEXT_MAX} characters).` };
  if (kind === "faq" && !question) return { error: "For an FAQ, add the question it answers." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Sign in again." };
  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!account) return { error: "Your session expired. Sign in again." };

  const { error } = await supabase.from("proof_points").insert({
    account_id: account.id,
    kind,
    text,
    question: kind === "faq" ? question : null,
    created_by: user.id,
  });
  if (error) return { error: "Could not save. Only workspace admins can manage proof points." };

  revalidatePath("/settings/proof");
  return { added: true };
}

/**
 * Remove one proof fact. RLS admin-manage gates the delete — T5: a 0-row match (member,
 * stale id) now RETURNS an error instead of silently no-oping and leaving the row on screen.
 */
export async function removeProofPoint(formData: FormData): Promise<{ error?: string }> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing proof point." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Sign in again." };
  const { data: deleted, error } = await supabase
    .from("proof_points")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error || !deleted) {
    return { error: "Could not remove it. Only workspace admins can manage proof points." };
  }
  revalidatePath("/settings/proof");
  return {};
}
