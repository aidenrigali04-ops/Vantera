import { redirect } from "next/navigation";
import { loadAgentShowcase } from "../agent-showcase-data";
import { AgentShowcase } from "../agent-showcase";

export const metadata = { title: "Prospect sourcing" };

export default async function ScoutAgentPage() {
  const agents = await loadAgentShowcase();
  if (!agents.some((a) => a.kind === "scout")) redirect("/playbook");
  return <AgentShowcase agents={agents} initialKind="scout" />;
}
