import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
export const runtime = "nodejs";
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });
  const { data: account } = await supabase.from("accounts").select("id").limit(1).maybeSingle();
  if (!account) return new Response("no account", { status: 403 });
  const { messageId, feedback } = await req.json();
  if (typeof messageId !== "string" || (feedback !== "up" && feedback !== "down")) return new Response("bad request", { status: 400 });
  const service = createServiceClient();
  await service.from("copilot_messages").update({ feedback, unhelpful: feedback === "down" }).eq("id", messageId).eq("account_id", (account as { id: string }).id);
  return new Response(null, { status: 204 });
}
