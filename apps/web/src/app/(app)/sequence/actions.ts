"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseSequenceForm } from "./parse";

export type SequenceState = { error?: string; saved?: boolean };

export async function saveSequenceConfig(
  _prev: SequenceState,
  fd: FormData
): Promise<SequenceState> {
  const config = parseSequenceForm(fd);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Sign in again." };

  // Account + campaign come from RLS-scoped reads, never the form (rule 02).
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!campaign) return { error: "Launch a campaign before configuring its sequence." };

  const { error } = await supabase
    .from("campaigns")
    .update({ sequence_config: config })
    .eq("id", campaign.id);
  if (error) return { error: "Could not save the sequence. Please try again." };
  revalidatePath("/sequence");
  return { saved: true };
}
