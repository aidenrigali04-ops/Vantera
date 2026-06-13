import { redirect } from "next/navigation";
import { loadAgentShowcase } from "../agent-showcase-data";
import { AgentShowcase } from "../agent-showcase";

export default async function CallerAgentPage() {
  const agents = await loadAgentShowcase();
  if (!agents.some((a) => a.kind === "caller")) redirect("/agents");
  return <AgentShowcase agents={agents} initialKind="caller" />;
}
