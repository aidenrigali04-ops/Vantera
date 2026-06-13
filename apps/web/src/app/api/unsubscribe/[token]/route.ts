import { createServiceClient } from "@/lib/supabase/service";
import { processUnsubscribe } from "@/server/unsubscribe";

const SUCCESS_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Unsubscribed</title>
  <style>
    body { margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: system-ui, sans-serif; background: #f9fafb; }
    p { color: #374151; font-size: 1rem; text-align: center; max-width: 28rem; padding: 2rem; }
  </style>
</head>
<body>
  <p>You're unsubscribed. You won't hear from this sender again.</p>
</body>
</html>`;

async function run(token: string): Promise<void> {
  const supabase = createServiceClient();
  await processUnsubscribe(token, {
    findToken: async (t) => {
      const { data } = await supabase
        .from("unsubscribe_tokens")
        .select("account_id, lead_id, email, used_at")
        .eq("token", t)
        .maybeSingle();
      if (!data) return null;
      return {
        accountId: data.account_id as string,
        leadId: data.lead_id as string,
        email: data.email as string,
        usedAt: data.used_at ? new Date(data.used_at as string) : null,
      };
    },
    addSuppression: async (accountId, email, leadId) => {
      await supabase.from("suppression_entries").upsert(
        { account_id: accountId, kind: "email", value: email, source: "unsubscribe", lead_id: leadId },
        { onConflict: "account_id,kind,value", ignoreDuplicates: true }
      );
    },
    markUsed: async (t) => {
      await supabase.from("unsubscribe_tokens").update({ used_at: new Date().toISOString() }).eq("token", t);
    },
    cancelPendingSends: async (leadId) => {
      await supabase
        .from("scheduled_sends")
        .update({ status: "canceled", error: "unsubscribed" })
        .eq("lead_id", leadId)
        .in("status", ["pending_review", "approved", "scheduled"]);
    },
  });
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // not_found renders the same success page — never reveal token validity to a scanner
  await run(token);
  return new Response(SUCCESS_HTML, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await run(token);
  return new Response(null, { status: 200 });
}
