import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { IntentWizard } from "../../intent-wizard";

export const metadata = { title: "Deploy intent detection" };

export default async function NewIntentAgentPage() {
  const supabase = await createClient();

  // The Intent Agent qualifies against the Scout's ICP (rule 06) — require a deployed Scout.
  const { data: scout } = await supabase
    .from("agents")
    .select("name")
    .eq("kind", "scout")
    .limit(1)
    .maybeSingle<{ name: string }>();
  if (!scout) redirect("/playbook");

  return <IntentWizard scoutName={scout.name} />;
}
