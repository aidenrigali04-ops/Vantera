export interface UnsubscribeDeps {
  findToken: (token: string) => Promise<{ accountId: string; leadId: string; email: string; usedAt: Date | null } | null>;
  addSuppression: (accountId: string, email: string, leadId: string) => Promise<void>;
  markUsed: (token: string) => Promise<void>;
  cancelPendingSends: (leadId: string) => Promise<void>;
}

export async function processUnsubscribe(token: string, deps: UnsubscribeDeps): Promise<"ok" | "not_found"> {
  const row = await deps.findToken(token);
  if (!row) return "not_found";
  if (row.usedAt) return "ok"; // idempotent — never an error page for a prospect
  await deps.addSuppression(row.accountId, row.email.toLowerCase(), row.leadId);
  await deps.markUsed(token);
  await deps.cancelPendingSends(row.leadId);
  return "ok";
}
