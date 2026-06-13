"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function acceptInvite(token: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/invite/${token}`);

  // Use service client so that the token lookup and membership insert work for
  // a user who is not yet a member of the target account (RLS would block both).
  const svc = createServiceClient();

  const { data: invite } = await svc
    .from("account_invites")
    .select("id, account_id, email, role, status, expires_at")
    .eq("token", token)
    .maybeSingle<{
      id: string;
      account_id: string;
      email: string;
      role: string;
      status: string;
      expires_at: string;
    }>();

  if (!invite || invite.status !== "pending")
    return { error: "This invitation is no longer valid." };
  if (new Date(invite.expires_at) < new Date())
    return { error: "This invitation has expired." };
  if ((user.email ?? "").toLowerCase() !== invite.email.toLowerCase())
    return { error: "This invitation was sent to a different email address." };

  const { error } = await svc.from("account_members").insert({
    account_id: invite.account_id,
    user_id: user.id,
    role: invite.role,
  });
  // 23505 = unique_violation: user is already a member, treat as success
  if (error && error.code !== "23505")
    return { error: "Could not join the workspace. Try again." };

  await svc
    .from("account_invites")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  redirect("/dashboard");
}
