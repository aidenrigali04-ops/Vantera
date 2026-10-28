/** The session user's own account_members rows (RLS-scoped: only accounts they belong to). */
export type MembershipRow = { account_id: string; role: string };

/**
 * Mirrors `public.is_account_admin`: owner or admin of THIS account. Settings writes
 * (like the deal size) are admin-only, so asks for them are shown to admins only.
 */
export function isAccountAdmin(rows: MembershipRow[] | null | undefined, accountId: string): boolean {
  const role = (rows ?? []).find((r) => r.account_id === accountId)?.role;
  return role === "owner" || role === "admin";
}
