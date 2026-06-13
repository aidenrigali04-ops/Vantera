"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveEntitlements } from "@vantera/billing";
import { snapshotFromRow, type AccountBillingRow } from "@/lib/billing/entitlement";
import { validateInvite, canManageTeam, seatCapReached } from "./validation";
import { sendInviteEmail } from "@vantera/transactional-email";

export type TeamActionState = { error?: string; success?: string };

async function callerContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, account: null, role: null };
  const { data: account } = await supabase
    .from("accounts")
    .select("id, name, plan, subscription_status, seats_purchased, linkedin_accounts_purchased, current_period_end")
    .limit(1)
    .maybeSingle();
  if (!account) return { supabase, user, account: null, role: null };
  const { data: membership } = await supabase
    .from("account_members")
    .select("role")
    .eq("account_id", account.id)
    .eq("user_id", user.id)
    .maybeSingle<{ role: string }>();
  return { supabase, user, account, role: membership?.role ?? null };
}

export async function inviteMember(_prev: TeamActionState, formData: FormData): Promise<TeamActionState> {
  const parsed = validateInvite({ email: formData.get("email"), role: formData.get("role") });
  if (!parsed.ok) return { error: parsed.error };

  const { supabase, user, account, role } = await callerContext();
  if (!user || !account) return { error: "Your session expired. Sign in again." };
  if (!canManageTeam(role ?? "")) return { error: "Only owners and admins can invite teammates." };

  const limits = resolveEntitlements(snapshotFromRow(account as AccountBillingRow));
  const [{ count: members }, { count: pending }] = await Promise.all([
    supabase.from("account_members").select("user_id", { count: "exact", head: true }).eq("account_id", account.id),
    supabase.from("account_invites").select("id", { count: "exact", head: true }).eq("account_id", account.id).eq("status", "pending"),
  ]);
  if (seatCapReached(members ?? 0, pending ?? 0, limits.maxSeats))
    return { error: "You've used all your seats. Add seats or upgrade your plan in Billing." };

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: invite, error } = await supabase
    .from("account_invites")
    .insert({ account_id: account.id, email: parsed.values.email, role: parsed.values.role, invited_by: user.id, expires_at: expiresAt })
    .select("token")
    .single<{ token: string }>();
  if (error || !invite) return { error: "Could not send the invite. Try again shortly." };

  try {
    await sendInviteEmail({
      to: parsed.values.email,
      inviteUrl: `${process.env.APP_URL ?? "http://localhost:3000"}/invite/${invite.token}`,
      workspaceName: (account as { name?: string }).name ?? "your team",
    });
  } catch {
    return { success: "Invite created. If the email doesn't arrive, resend it." };
  }

  revalidatePath("/settings/team");
  return { success: `Invitation sent to ${parsed.values.email}.` };
}

export async function revokeInvite(_prev: TeamActionState, formData: FormData): Promise<TeamActionState> {
  const inviteId = String(formData.get("inviteId") ?? "");
  const { supabase, account, role } = await callerContext();
  if (!account) return { error: "Your session expired. Sign in again." };
  if (!canManageTeam(role ?? "")) return { error: "Only owners and admins can manage invites." };
  const { error } = await supabase
    .from("account_invites")
    .update({ status: "revoked" })
    .eq("id", inviteId)
    .eq("account_id", account.id)
    .eq("status", "pending");
  if (error) return { error: "Could not revoke the invite." };
  revalidatePath("/settings/team");
  return { success: "Invite revoked." };
}

export async function removeMember(_prev: TeamActionState, formData: FormData): Promise<TeamActionState> {
  const userId = String(formData.get("userId") ?? "");
  const { supabase, account, role } = await callerContext();
  if (!account) return { error: "Your session expired. Sign in again." };
  if (!canManageTeam(role ?? "")) return { error: "Only owners and admins can remove members." };
  const { data: target } = await supabase
    .from("account_members")
    .select("role")
    .eq("account_id", account.id)
    .eq("user_id", userId)
    .maybeSingle<{ role: string }>();
  if (target?.role === "owner") return { error: "You can't remove the workspace owner." };
  const { error } = await supabase
    .from("account_members")
    .delete()
    .eq("account_id", account.id)
    .eq("user_id", userId);
  if (error) return { error: "Could not remove the member." };
  revalidatePath("/settings/team");
  return { success: "Member removed." };
}
