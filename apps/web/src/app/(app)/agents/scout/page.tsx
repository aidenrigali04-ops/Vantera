import { redirect } from "next/navigation";
import { loadAgentShowcase } from "../agent-showcase-data";
import { AgentShowcase } from "../agent-showcase";

export default async function ScoutAgentPage() {
  const agents = await loadAgentShowcase();
  if (!agents.some((a) => a.kind === "scout")) redirect("/agents");
  return <AgentShowcase agents={agents} initialKind="scout" />;
}
