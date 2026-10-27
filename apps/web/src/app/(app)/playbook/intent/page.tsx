import { redirect } from "next/navigation";
import { loadAgentShowcase } from "../agent-showcase-data";
import { AgentShowcase } from "../agent-showcase";

export const metadata = { title: "Intent detection" };

export default async function IntentAgentPage() {
  const { agents, activity } = await loadAgentShowcase();
  if (!agents.some((a) => a.kind === "intent")) redirect("/playbook");
  return <AgentShowcase agents={agents} activity={activity} initialKind="intent" />;
}
