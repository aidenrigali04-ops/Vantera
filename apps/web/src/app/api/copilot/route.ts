import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  runCopilotTurn,
  searchKnowledgeTool,
  type CopilotEvent,
  type CopilotTool,
} from "@vantera/help-agent";
import { getModel } from "@vantera/ai";
import { makeRetriever } from "@/server/copilot/retriever";
import { ensureConversation, saveMessage, auditAction } from "@/server/copilot/persist";
import { buildAccountTools } from "@/server/copilot/tools";
import { navigateTools } from "@/server/copilot/navigate-tools";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // Resolve user and account exclusively from the session — body accountId is NEVER trusted.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (!account) return new Response("no account", { status: 403 });
  const accountId = (account as { id: string }).id;

  // body.accountId is intentionally ignored — we only read message/conversationId/surface/approvedAction
  const body = (await req.json()) as {
    message?: string;
    conversationId?: string;
    surface?: string;
    approvedAction?: { tool: string; params: Record<string, unknown> };
  };

  // FIX 2: validate that there is a usable message or an approvedAction resume
  const hasMessage = typeof body.message === "string" && body.message.trim().length > 0;
  if (!hasMessage && !body.approvedAction) {
    return new Response("bad request", { status: 400 });
  }

  const service = createServiceClient();
  const conversationId = await ensureConversation(
    service,
    accountId,
    user.id,
    body.surface,
    body.conversationId
  );

  const retrieve = makeRetriever(service);
  const tools: CopilotTool[] = [searchKnowledgeTool as unknown as CopilotTool, ...buildAccountTools(supabase, accountId), ...navigateTools];

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (e: CopilotEvent) =>
        controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));

      let assistantText = "";
      try {
        if (typeof body.message === "string" && body.message.trim().length > 0) {
          await saveMessage(service, {
            conversationId,
            accountId,
            role: "user",
            content: body.message,
          });
        }

        await runCopilotTurn({
          model: getModel(),
          messages: [{ role: "user", content: body.message ?? "" }],
          tools,
          ctx: { accountId, retrieve },
          approvedAction: body.approvedAction,
          onEvent: (e: CopilotEvent) => {
            if (e.type === "text") assistantText += e.delta;
            if (e.type === "outcome") {
              void auditAction(service, {
                conversationId,
                accountId,
                userId: user.id,
                tool: e.tool,
                tier: "mutate",
                resultStatus: "success",
                undoable: e.undoable,
              }).catch((err) => console.error("copilot audit failed", err));
            }
            send(e);
          },
        });

        const assistantId = await saveMessage(service, {
          conversationId,
          accountId,
          role: "assistant",
          content: assistantText,
        });
        send({ type: "meta", conversationId, assistantMessageId: assistantId });
      } catch {
        send({ type: "error", message: "Something went wrong. Please try again." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson",
      "cache-control": "no-store",
    },
  });
}
