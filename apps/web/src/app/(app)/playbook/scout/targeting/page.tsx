import { redirect } from "next/navigation";
import { normalizeTargetingRules } from "@vantera/agent-brains";
import { createClient } from "@/lib/supabase/server";
import { TargetingForm } from "./targeting-form";

export const metadata = { title: "Targeting rules" };

/** ML-5: who your agents should skip, and who to favor — applies to every new prospect. */
export default async function ScoutTargetingPage() {
  const supabase = await createClient();
  const { data: agent } = await supabase
    .from("agents")
    .select("config")
    .eq("kind", "scout")
    .limit(1)
    .maybeSingle<{ config: Record<string, unknown> | null }>();
  if (!agent) redirect("/playbook");

  return <TargetingForm initial={normalizeTargetingRules(agent.config?.targeting)} />;
}
