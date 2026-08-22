import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ScoutWizard } from "../../scout-wizard";

export const metadata = { title: "Edit prospect sourcing" };

export default async function EditScoutAgentPage() {
  const supabase = await createClient();

  const { data: agent } = await supabase
    .from("agents")
    .select("name, run_at_time, cadence, agent_icps(position, icps(name))")
    .eq("kind", "scout")
    .limit(1)
    .maybeSingle<{
      name: string;
      run_at_time: string | null;
      cadence: "daily" | "weekly" | null;
      agent_icps: { position: number; icps: { name: string } | null }[];
    }>();
  if (!agent) redirect("/playbook");

  const [{ data: account }, { data: icps }] = await Promise.all([
    supabase.from("accounts").select("onboarding_icp").limit(1).maybeSingle<{
      onboarding_icp: string | null;
    }>(),
    supabase.from("icps").select("name").order("created_at", { ascending: false }).limit(20),
  ]);

  const icpNames = (agent.agent_icps ?? [])
    .sort((a, b) => a.position - b.position)
    .map((l) => l.icps?.name)
    .filter((n): n is string => Boolean(n));

  return (
    <ScoutWizard
      defaultIcp={account?.onboarding_icp ?? null}
      existingIcps={(icps ?? []).map((i) => i.name)}
      edit={{
        name: agent.name,
        icps: icpNames,
        // Postgres returns time as HH:MM:SS — the picker + validation expect HH:MM
        runAtTime: (agent.run_at_time ?? "08:00").slice(0, 5),
        cadence: agent.cadence ?? "daily",
      }}
    />
  );
}
