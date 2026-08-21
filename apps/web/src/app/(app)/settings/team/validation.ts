import type { Valid, Invalid } from "@/lib/validation";

export type InviteRole = "admin" | "member";

export interface InviteValues {
  email: string;
  role: InviteRole;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function validateInvite(input: Record<string, unknown>): Valid<InviteValues> | Invalid {
  const email = String(input.email ?? "").trim().toLowerCase();
  const role = String(input.role ?? "");
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (role !== "admin" && role !== "member")
    return { ok: false, error: "Role must be admin or member." };
  return { ok: true, values: { email, role } };
}

export function canManageTeam(role: string): boolean {
  return role === "owner" || role === "admin";
}

/** Members already in the account + pending invites both consume a seat. */
export function seatCapReached(memberCount: number, pendingInvites: number, maxSeats: number): boolean {
  return memberCount + pendingInvites >= maxSeats;
}

/**
 * Name non-owner members by zipping them, in join order, with accepted invites in accept order.
 * Sound because accept_invite (migration 0001) is the ONLY path that creates a non-owner member:
 * it verifies the accepting user's email matches the invite, then writes the member row and
 * accepted_at in the same transaction — so the k-th non-owner member is the k-th accepted invite.
 * Auth emails aren't client-readable and user_profiles is deliberately self-only (RLS), so this
 * is the honest client-side source. Unmatched members simply get no entry — callers fall back.
 */
export function matchMemberEmails(
  members: { user_id: string; role: string; created_at: string }[],
  acceptedInvites: { email: string; accepted_at: string | null }[]
): Map<string, string> {
  const joiners = members
    .filter((m) => m.role !== "owner")
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const invites = [...acceptedInvites].sort((a, b) =>
    (a.accepted_at ?? "").localeCompare(b.accepted_at ?? "")
  );
  const byId = new Map<string, string>();
  joiners.forEach((m, i) => {
    const email = invites[i]?.email;
    if (email) byId.set(m.user_id, email);
  });
  return byId;
}
