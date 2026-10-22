import { redirect } from "next/navigation";
import { normalizeTargetingRules } from "@vantera/agent-brains";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, PANEL } from "@/components/app/surface";
import type { IcpEditorValue } from "@/components/icp/icp-editor";
import { TargetingForm } from "./targeting-form";

export const metadata = { title: "Targeting" };

type Criteria = Partial<IcpEditorValue["criteria"]> | null;
const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** Your buyers + who to skip — the same editor as onboarding, applied to every new prospect. */
export default async function ScoutTargetingPage() {
  const supabase = await createClient();
  const { data: agent } = await supabase
    .from("agents")
    .select("id, config")
    .eq("kind", "scout")
    .limit(1)
    .maybeSingle<{ id: string; config: Record<string, unknown> | null }>();
  if (!agent) redirect("/playbook");

  const { data: onboardingIcp } = await supabase
    .from("icps")
    .select("name, criteria")
    .eq("source", "onboarding")
    .limit(1)
    .maybeSingle<{ name: string; criteria: Criteria }>();

  let name = onboardingIcp?.name;
  if (!name) {
    const { data: link } = await supabase
      .from("agent_icps")
      .select("icps(name)")
      .eq("agent_id", agent.id)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle<{ icps: { name: string } | null }>();
    name = link?.icps?.name;
  }

  const c = onboardingIcp?.criteria;
  const value: IcpEditorValue = {
    name: name ?? "Ideal buyers",
    criteria: {
      titles: list(c?.titles),
      industries: list(c?.industries),
      companySizes: list(c?.companySizes),
      geos: list(c?.geos),
      signals: list(c?.signals),
    },
    targeting: normalizeTargetingRules(agent.config?.targeting),
  };

  return (
    <div className="mx-auto w-full max-w-2xl py-8">
      <PageHeader title="Targeting" subtitle="Who your agents look for and who they skip. Applies to every new prospect." />
      <div className={`${PANEL} mt-8 p-8`}>
        <TargetingForm value={value} />
      </div>
    </div>
  );
}
