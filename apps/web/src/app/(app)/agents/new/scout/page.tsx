import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ScoutWizard } from "../../scout-wizard";

export const metadata = { title: "Deploy prospect sourcing" };

export default async function NewScoutAgentPage() {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("agents")
    .select("id")
    .eq("kind", "scout")
    .limit(1)
    .maybeSingle();
  if (existing) redirect("/agents");

  const [{ data: account }, { data: icps }] = await Promise.all([
    supabase.from("accounts").select("onboarding_icp").limit(1).maybeSingle<{
      onboarding_icp: string | null;
    }>(),
    supabase.from("icps").select("name").order("created_at", { ascending: false }).limit(20),
  ]);

  return (
    <ScoutWizard
      defaultIcp={account?.onboarding_icp ?? null}
      existingIcps={(icps ?? []).map((i) => i.name)}
    />
  );
}
