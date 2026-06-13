import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// ── Service client mock ───────────────────────────────────────────────────────
// Track inserts so we can assert on what account_id was written.

const insertedMessages: Array<Record<string, unknown>> = [];
const insertedConversations: Array<Record<string, unknown>> = [];

function makeServiceChain(table: string) {
  return {
    insert: (row: Record<string, unknown>) => {
      if (table === "copilot_messages") insertedMessages.push(row);
      if (table === "copilot_conversations") insertedConversations.push(row);
      return {
        select: (_cols: string) => ({
          single: async () => ({ data: { id: "msg-id-stub" }, error: null }),
        }),
      };
    },
    update: (_vals: unknown) => ({
      eq: (_col: string, _val: string) => Promise.resolve({}),
    }),
    select: (_cols: string) => ({
      eq: (_col: string, _val: string) => Promise.resolve({}),
    }),
  } as unknown as ReturnType<SupabaseClient["from"]>;
}

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: (table: string) => makeServiceChain(table),
    rpc: async () => ({ data: [] }),
  }),
}));

// ── Session client factory — default: authenticated ───────────────────────────

function makeSessionClient(opts: { userId: string | null; accountId: string | null }) {
  return {
    auth: {
      getUser: async () => ({
        data: { user: opts.userId ? { id: opts.userId } : null },
      }),
    },
    from: (table: string) => ({
      select: (_cols: string) => ({
        limit: (_n: number) => ({
          maybeSingle: async () =>
            table === "accounts" && opts.accountId
              ? { data: { id: opts.accountId } }
              : { data: null },
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

// Default: authenticated with a real account
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => makeSessionClient({ userId: "user-real", accountId: "acct-real" }),
}));

// ── AI / help-agent mocks ────────────────────────────────────────────────────

vi.mock("@vantera/ai", () => ({
  getModel: () => ({ __type: "stub-model" }),
  createEmbedderFromEnv: () => ({
    embed: async (_texts: string[], _type: string) => [[0.1, 0.2, 0.3]],
  }),
}));

// runCopilotTurn: immediately emits one text event then returns
vi.mock("@vantera/help-agent", () => ({
  runCopilotTurn: async ({ onEvent }: { onEvent: (e: unknown) => void }) => {
    onEvent({ type: "text", delta: "Hello from the copilot." });
  },
  searchKnowledgeTool: {
    name: "searchKnowledge",
    tier: "read" as const,
    description: "stub search tool",
    parameters: { parse: () => ({}) },
    run: async () => ({ chunks: [] }),
  },
}));

// ── Import route AFTER all mocks ──────────────────────────────────────────────

import { POST } from "./route";
import * as serverModule from "@/lib/supabase/server";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function consumeNdjson(res: Response): Promise<unknown[]> {
  const text = await res.text();
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/copilot", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/copilot", () => {
  beforeEach(() => {
    insertedMessages.length = 0;
    insertedConversations.length = 0;
  });

  it("returns 200 and streams ndjson events including a meta event", async () => {
    const res = await POST(makeRequest({ message: "How does review mode work?" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/x-ndjson");

    const events = await consumeNdjson(res);
    const types = (events as Array<{ type: string }>).map((e) => e.type);
    expect(types).toContain("text");
    expect(types).toContain("meta");
  });

  it("TENANT ISOLATION: body accountId is ignored; persisted messages use the session account", async () => {
    // Body carries an attacker-supplied accountId — it must NEVER appear in any DB write.
    const res = await POST(
      makeRequest({
        message: "Tell me about my campaign",
        accountId: "attacker-acct",
      })
    );
    expect(res.status).toBe(200);
    // Drain the stream so all persistence calls have completed.
    await consumeNdjson(res);

    // Both user and assistant messages must carry the session-resolved account id.
    expect(insertedMessages.length).toBeGreaterThanOrEqual(2);
    for (const msg of insertedMessages) {
      expect(msg.account_id).toBe("acct-real");
      expect(msg.account_id).not.toBe("attacker-acct");
    }
  });

  it("returns 401 when there is no authenticated user", async () => {
    // Swap session client to return null user for this one call.
    const spy = vi
      .spyOn(serverModule, "createClient")
      .mockResolvedValueOnce(
        makeSessionClient({ userId: null, accountId: null })
      );

    const res = await POST(makeRequest({ message: "hello" }));
    expect(res.status).toBe(401);

    spy.mockRestore();
  });
});
