import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { IntentWizard } from "../../intent-wizard";
import { intentEditValues, type IntentAgentRow } from "../../intent-edit-values";

export const metadata = { title: "Edit intent detection" };

export default async function EditIntentAgentPage() {
  const supabase = await createClient();

  // RLS scopes both reads to the session's account (rule 02)
  const [{ data: agent }, { data: scout }] = await Promise.all([
    supabase
      .from("agents")
      .select("name, status, config, run_at_time, cadence, timezone")
      .eq("kind", "intent")
      .limit(1)
      .maybeSingle<IntentAgentRow & { status: string }>(),
    supabase.from("agents").select("name").eq("kind", "scout").limit(1).maybeSingle<{ name: string }>(),
  ]);
  if (!agent) redirect("/playbook");

  return (
    <IntentWizard
      scoutName={scout?.name ?? "your Prospect Agent"}
      edit={intentEditValues(agent)}
      paused={agent.status === "paused"}
    />
  );
}
