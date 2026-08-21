import { createServiceClient } from "@/lib/supabase/service";

/**
 * R3: server-side invite lookup for PRE-auth surfaces (the invite landing page and
 * invite-signup). The invitee has no session yet, so RLS can't admit them — the service
 * client reads only the display-safe subset, and acceptance itself still goes through
 * the security-definer `accept_invite` RPC (token + expiry + email binding re-checked).
 */
export type InviteSummary = {
  token: string;
  email: string;
  role: string;
  workspaceName: string;
  state: "valid" | "expired" | "used";
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function lookupInvite(token: string): Promise<InviteSummary | null> {
  if (!UUID_RE.test(token)) return null;
  const service = createServiceClient();
  const { data: invite } = await service
    .from("account_invites")
    .select("email, role, status, expires_at, account_id")
    .eq("token", token)
    .maybeSingle<{ email: string; role: string; status: string; expires_at: string; account_id: string }>();
  if (!invite) return null;

  const { data: account } = await service
    .from("accounts")
    .select("name")
    .eq("id", invite.account_id)
    .maybeSingle<{ name: string | null }>();

  const state: InviteSummary["state"] =
    invite.status !== "pending"
      ? "used"
      : new Date(invite.expires_at).getTime() < Date.now()
        ? "expired"
        : "valid";

  return {
    token,
    email: invite.email,
    role: invite.role,
    workspaceName: account?.name ?? "your team",
    state,
  };
}
