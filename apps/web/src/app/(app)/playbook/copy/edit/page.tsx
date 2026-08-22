import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CopyWizard } from "../../copy-wizard";

export const metadata = { title: "Edit outreach" };

export default async function EditCopyAgentPage() {
  const supabase = await createClient();

  const { data: agent } = await supabase
    .from("agents")
    .select("id, name, config, campaigns(send_mode)")
    .eq("kind", "copy")
    .limit(1)
    .maybeSingle<{
      id: string;
      name: string;
      config: { cta?: string; bookingUrl?: string | null; websiteUrl?: string | null; channels?: { linkedin?: boolean } } | null;
      campaigns: { send_mode: string | null } | null;
    }>();
  if (!agent) redirect("/playbook");

  const { data: scout } = await supabase
    .from("agents")
    .select("name, agent_icps(position, icps(name))")
    .eq("kind", "scout")
    .limit(1)
    .maybeSingle<{
      name: string;
      agent_icps: { position: number; icps: { name: string } | null }[];
    }>();
  if (!scout) redirect("/playbook");

  const [{ data: linkAssets }, { count: linkedinCount }] = await Promise.all([
    supabase.from("agent_assets").select("url").eq("agent_id", agent.id).eq("kind", "link"),
    supabase.from("linkedin_accounts").select("id", { count: "exact", head: true }),
  ]);

  const icpNames = (scout.agent_icps ?? [])
    .sort((a, b) => a.position - b.position)
    .map((l) => l.icps?.name)
    .filter((n): n is string => Boolean(n));

  const links = (linkAssets ?? [])
    .map((a) => (a as { url: string | null }).url)
    .filter((u): u is string => Boolean(u))
    .join("\n");

  return (
    <CopyWizard
      scoutName={scout.name}
      icpNames={icpNames}
      linkedinCount={linkedinCount ?? 0}
      edit={{
        name: agent.name,
        cta: agent.config?.cta ?? "",
        bookingUrl: agent.config?.bookingUrl ?? "",
        websiteUrl: agent.config?.websiteUrl ?? "",
        links,
        channels: {
          linkedin: agent.config?.channels?.linkedin ?? true,
        },
        sendMode: agent.campaigns?.send_mode === "automatic" ? "automatic" : "review",
      }}
    />
  );
}
