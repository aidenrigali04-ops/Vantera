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
