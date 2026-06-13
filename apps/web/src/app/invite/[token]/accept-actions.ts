"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function acceptInvite(token: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/invite/${token}`);

  const { data, error } = await supabase.rpc("accept_invite", { invite_token: token });

  if (error)
    return {
      error:
        "This invitation is no longer valid, has expired, or was sent to a different email address.",
    };

  // data is the account_id returned by the RPC — redirect on success
  void data;
  redirect("/dashboard");
}
