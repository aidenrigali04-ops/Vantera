"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Mark lead notifications read. RLS (migration 0017 lead_notifications_update)
 * scopes the update to the member's own account — no account id is passed.
 */
export async function markNotificationsRead(ids: string[]): Promise<{ ok: boolean }> {
  if (ids.length === 0) return { ok: true };
  const supabase = await createClient();
  const { error } = await supabase
    .from("lead_notifications")
    .update({ read_at: new Date().toISOString() })
    .in("id", ids);
  revalidatePath("/dashboard");
  revalidatePath("/prospects");
  return { ok: !error };
}
