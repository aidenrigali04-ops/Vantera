import type { SupabaseClient } from "@supabase/supabase-js";

type Service = SupabaseClient;

export async function ensureConversation(
  db: Service,
  accountId: string,
  userId: string,
  surface?: string,
  existing?: string
): Promise<string> {
  if (existing) {
    const { data } = await db.from("copilot_conversations")
      .update({ updated_at: new Date().toISOString(), current_surface: surface ?? null })
      .eq("id", existing)
      .eq("account_id", accountId)   // tenant ownership guard (rule 02)
      .select("id")
      .maybeSingle();
    if (data) return (data as { id: string }).id;
    // not owned / not found → fall through and start a fresh conversation
  }
  const { data, error } = await db
    .from("copilot_conversations")
    .insert({ account_id: accountId, user_id: userId, current_surface: surface ?? null })
    .select("id")
    .single();
  if (error || !data) throw new Error("could not start conversation");
  return (data as { id: string }).id;
}

export async function saveMessage(
  db: Service,
  m: {
    conversationId: string;
    accountId: string;
    role: "user" | "assistant";
    content: string;
    toolCalls?: unknown;
  }
): Promise<string> {
  const { data, error } = await db
    .from("copilot_messages")
    .insert({
      conversation_id: m.conversationId,
      account_id: m.accountId,
      role: m.role,
      content: m.content,
      tool_calls: m.toolCalls ?? null,
    })
    .select("id")
    .single();
  if (error) console.error("copilot saveMessage failed", error);
  return (data as { id: string } | null)?.id ?? "";
}

export async function auditAction(
  db: Service,
  a: {
    conversationId: string;
    accountId: string;
    userId: string;
    tool: string;
    tier: string;
    resultStatus: string;
    undoable: boolean;
  }
): Promise<void> {
  await db.from("copilot_actions").insert({
    account_id: a.accountId,
    user_id: a.userId,
    conversation_id: a.conversationId,
    tool_name: a.tool,
    tier: a.tier,
    result_status: a.resultStatus,
    undoable: a.undoable,
    undo_expires_at: a.undoable ? new Date(Date.now() + 30_000).toISOString() : null,
  });
}
