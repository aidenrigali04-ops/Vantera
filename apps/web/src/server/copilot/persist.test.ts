import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureConversation } from "./persist";

// ── Fake DB builder ────────────────────────────────────────────────────────────

/**
 * Builds a minimal fake SupabaseClient for ensureConversation tests.
 *
 * @param updateReturnsRow - when true, the ownership-scoped UPDATE returns a
 *   matching row (conversation is owned by the requested account). When false,
 *   it returns null (not owned / doesn't exist).
 */
function makeFakeDb(updateReturnsRow: boolean) {
  const calls = { updateCalled: false, insertCalled: false };

  const db = {
    calls,
    from(table: string) {
      if (table === "copilot_conversations") {
        return {
          // UPDATE path (existing conversation)
          update: (_vals: unknown) => ({
            eq: (_col1: string, _val1: string) => ({
              eq: (_col2: string, _val2: string) => ({
                select: (_cols: string) => ({
                  maybeSingle: async () => {
                    calls.updateCalled = true;
                    return updateReturnsRow
                      ? { data: { id: "existing-conv-id" } }
                      : { data: null };
                  },
                }),
              }),
            }),
          }),
          // INSERT path (new conversation)
          insert: (_row: unknown) => ({
            select: (_cols: string) => ({
              single: async () => {
                calls.insertCalled = true;
                return { data: { id: "new-conv-id" }, error: null };
              },
            }),
          }),
        };
      }
      // Fallback for any other table
      return {} as unknown as Record<string, unknown>;
    },
  } as unknown as SupabaseClient & { calls: typeof calls };

  return db;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ensureConversation — FIX 1 ownership guard", () => {
  it("(a) ownership-scoped update returns a row → returns that id, no insert", async () => {
    const db = makeFakeDb(true);
    const id = await ensureConversation(db, "acct-owner", "user-1", "dashboard", "existing-conv-id");

    expect(id).toBe("existing-conv-id");
    expect(db.calls.updateCalled).toBe(true);
    expect(db.calls.insertCalled).toBe(false);
  });

  it("(b) ownership-scoped update returns null (not owned) → falls through to insert, returns new id", async () => {
    const db = makeFakeDb(false);
    // Pass a conversationId that belongs to a DIFFERENT account — the update
    // will find no matching row (different account_id), so ensureConversation
    // must fall through and create a fresh conversation.
    const id = await ensureConversation(db, "acct-real", "user-1", "dashboard", "foreign-conv-id");

    expect(id).toBe("new-conv-id");
    expect(db.calls.updateCalled).toBe(true);   // attempted ownership check
    expect(db.calls.insertCalled).toBe(true);    // fell through to insert
  });
});
